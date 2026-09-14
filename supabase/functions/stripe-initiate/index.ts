// Stripe checkout initiation
//
// STATUS: real, complete logic -- INACTIVE until you configure a
// Stripe secret key. Without it, returns a clear 'not_configured'
// response rather than failing confusingly or faking a payment link.
//
// SETUP (once you have a Stripe account):
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxx
//   supabase functions deploy stripe-initiate
//   supabase functions deploy stripe-webhook
// Then in the Stripe dashboard (Developers > Webhooks), add an endpoint:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// listening for the `checkout.session.completed` event, and store its
// signing secret as:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// FLOW: identical shape to flutterwave-initiate/paystack-initiate/
// payunit-initiate -- this function only ever creates a 'pending'
// payment row and a redirect link; stripe-webhook is the only thing
// that grants access, after re-verifying Stripe's signature and the
// confirmed amount. This deliberately uses a one-off Checkout Session
// (mode=payment) rather than Stripe's native recurring Subscription
// object, so Stripe fits the same billing model every other gateway
// here already uses (tenant_subscriptions tracks the access window;
// billing-housekeeping handles expiry/renewal), instead of introducing
// a second, different subscription-lifecycle model side by side with
// the other three gateways.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}

// Stripe's API takes application/x-www-form-urlencoded, including for
// nested objects (bracket notation) -- there is no JSON body mode.
function toFormBody(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) {
    return json({ status: 'not_configured', message: 'STRIPE_SECRET_KEY is not set. Payment cannot be initiated until it is configured.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'invalid_session' }, 401);

  const { plan_id, billing_cycle } = await req.json();
  if (!plan_id || !['monthly', 'yearly'].includes(billing_cycle)) {
    return json({ error: 'invalid_request', message: 'plan_id and billing_cycle (monthly|yearly) are required.' }, 400);
  }

  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: membership } = await db.from('tenant_memberships').select('tenant_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
  if (!membership) return json({ error: 'no_tenant', message: 'This account is not linked to an institution.' }, 403);

  const { data: plan, error: planErr } = await db.from('subscription_plans').select('id, name, price_monthly, price_yearly').eq('id', plan_id).eq('is_active', true).maybeSingle();
  if (planErr || !plan) return json({ error: 'plan_not_found' }, 404);

  const { data: tenant } = await db.from('tenants').select('id, legal_name, email, commercial_name').eq('id', membership.tenant_id).maybeSingle();
  if (!tenant) return json({ error: 'tenant_not_found' }, 404);

  const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const txRef = `hc_${tenant.id}_${Date.now()}`;

  const { data: paymentRow, error: payErr } = await db.from('payments').insert({
    tenant_id: tenant.id,
    amount,
    currency: 'USD',
    gateway: 'stripe',
    gateway_tx_id: txRef,
    status: 'pending',
    metadata: { plan_id: plan.id, billing_cycle },
  }).select().single();
  if (payErr) return json({ error: 'payment_row_failed', message: payErr.message }, 500);

  // Same trusted-redirect-origin policy as every other gateway here --
  // never derived from a spoofable request header alone.
  const allowedOriginsRaw = (Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '').trim();
  const publicUrl = (Deno.env.get('APP_PUBLIC_URL') ?? '').trim().replace(/\/+$/, '');
  const requestOrigin = (req.headers.get('origin') ?? '').trim().replace(/\/+$/, '');
  const allowed = new Set(allowedOriginsRaw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean));
  if (publicUrl) allowed.add(publicUrl);

  let redirectBase = publicUrl;
  if (!redirectBase && allowed.has(requestOrigin)) redirectBase = requestOrigin;
  if (!redirectBase) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), reason: 'no_allowed_redirect_origin' } }).eq('id', paymentRow.id);
    return json({ error: 'no_allowed_redirect_origin', message: 'APP_PUBLIC_URL / ALLOWED_REDIRECT_ORIGINS is not configured.' }, 500);
  }

  const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toFormBody({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][price_data][product_data][name]': `Health Cloud — ${plan.name} (${billing_cycle})`,
      client_reference_id: txRef,
      customer_email: tenant.email ?? '',
      success_url: `${redirectBase}/app/settings?billing=complete`,
      cancel_url: `${redirectBase}/app/settings?billing=cancelled`,
      'metadata[payment_id]': paymentRow.id,
      'metadata[tenant_id]': tenant.id,
      'metadata[plan_id]': plan.id,
      'metadata[billing_cycle]': billing_cycle,
    }),
  });
  const session = await stripeResp.json();

  if (!stripeResp.ok || !session.url) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), stripe_error: session } }).eq('id', paymentRow.id);
    return json({ error: 'stripe_error', message: session?.error?.message ?? 'Failed to create checkout session' }, 502);
  }

  return json({ payment_link: session.url, tx_ref: txRef });
});
