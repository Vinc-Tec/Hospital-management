// Paystack checkout initiation
//
// STATUS: real, complete logic -- INACTIVE until you configure a
// Paystack secret key. Without it, returns a clear 'not_configured'
// response rather than failing confusingly or faking a payment link.
//
// SETUP (once you have a Paystack account):
//   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxxxxx
//   supabase secrets set PAYSTACK_CURRENCY=USD   (Paystack also supports NGN, GHS, ZAR, KES -- confirm which your account is enabled for)
// Then in the Paystack dashboard (Settings > API Keys & Webhooks), set
// the webhook URL to:
//   https://<project-ref>.supabase.co/functions/v1/paystack-webhook
// Paystack does not use a separate webhook secret -- it signs every
// webhook with your PAYSTACK_SECRET_KEY itself (see paystack-webhook).
//
// FLOW (same shape as flutterwave-initiate / payunit-initiate):
//   1. The authenticated tenant owner/admin calls this function with
//      { plan_id, billing_cycle: 'monthly' | 'yearly' }.
//   2. This function verifies the caller really belongs to the tenant it
//      claims (via their JWT), looks up the plan's real price
//      server-side, creates a 'pending' row in `payments`, and asks
//      Paystack for a hosted checkout link.
//   3. The browser redirects the user to that link to actually pay.
//   4. Paystack calls paystack-webhook when the payment completes; THAT
//      function re-verifies the transaction via Paystack's own Verify
//      Transaction API before granting any access.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  const currency = (Deno.env.get('PAYSTACK_CURRENCY') ?? 'USD').trim();
  if (!secretKey) {
    return json({ status: 'not_configured', message: 'PAYSTACK_SECRET_KEY is not set. Payment cannot be initiated until it is configured.' });
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

  // Server-side price lookup -- the amount charged is never taken from
  // the client request. Plan prices are stored in USD; if
  // PAYSTACK_CURRENCY is ever set to something other than USD, convert
  // using a live rate rather than sending the raw USD number under a
  // different currency label (which would silently mis-charge by the
  // full exchange rate multiple).
  const usdAmount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  let amount = usdAmount;
  if (currency !== 'USD') {
    const rateResp = await fetch('https://open.er-api.com/v6/latest/USD');
    const rateData = await rateResp.json();
    const rate = rateData?.result === 'success' ? rateData.rates?.[currency] : null;
    if (!rate) {
      return json({ error: 'fx_rate_unavailable', message: `Could not fetch a live USD -> ${currency} exchange rate. Try again shortly.` }, 502);
    }
    const converted = usdAmount * rate;
    amount = ['XAF', 'XOF'].includes(currency) ? Math.round(converted) : Math.round(converted * 100) / 100;
  }
  const txRef = `ps_${tenant.id}_${Date.now()}`;

  const { data: paymentRow, error: payErr } = await db.from('payments').insert({
    tenant_id: tenant.id,
    amount,
    currency,
    gateway: 'paystack',
    gateway_tx_id: txRef,
    status: 'pending',
    metadata: { plan_id: plan.id, billing_cycle, usd_amount: usdAmount },
  }).select().single();
  if (payErr) return json({ error: 'payment_row_failed', message: payErr.message }, 500);

  // redirect_url must be a trusted, configured origin -- same guard as
  // the other gateways.
  const allowedOriginsRaw = (Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '').trim();
  const publicUrl = (Deno.env.get('APP_PUBLIC_URL') ?? '').trim().replace(/\/+$/, '');
  const requestOrigin = (req.headers.get('origin') ?? '').trim().replace(/\/+$/, '');
  const allowed = new Set(
    allowedOriginsRaw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
  );
  if (publicUrl) allowed.add(publicUrl);

  let redirectBase = publicUrl;
  if (!redirectBase && allowed.has(requestOrigin)) redirectBase = requestOrigin;
  if (!redirectBase) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), reason: 'no_allowed_redirect_origin' } }).eq('id', paymentRow.id);
    return json({ error: 'no_allowed_redirect_origin', message: 'APP_PUBLIC_URL / ALLOWED_REDIRECT_ORIGINS is not configured.' }, 500);
  }

  const callbackUrl = `${redirectBase}/app/settings?billing=complete`;

  // Paystack amounts are in the currency's smallest unit (cents for USD,
  // kobo for NGN, etc.) -- multiply by 100 for a two-decimal currency.
  const paystackResp = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: tenant.email,
      amount: Math.round(amount * 100),
      currency,
      reference: txRef,
      callback_url: callbackUrl,
      metadata: { payment_id: paymentRow.id, tenant_id: tenant.id, plan_id: plan.id, billing_cycle },
    }),
  });

  const psData = await paystackResp.json();
  if (!psData.status || !psData.data?.authorization_url) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), paystack_error: psData } }).eq('id', paymentRow.id);
    return json({ error: 'paystack_error', message: psData.message ?? 'Failed to create payment link' }, 502);
  }

  return json({ payment_link: psData.data.authorization_url, tx_ref: txRef });
});
