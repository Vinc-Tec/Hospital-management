// PayUnit checkout initiation
//
// STATUS: real, complete logic -- INACTIVE until you configure PayUnit
// credentials. Without them, returns a clear 'not_configured' response
// rather than failing confusingly or faking a payment link.
//
// SETUP (from your PayUnit merchant dashboard -> API CREDENTIALS tab,
// and your application's APPLICATION DETAIL tab):
//   supabase secrets set PAYUNIT_API_USER=<api_user>
//   supabase secrets set PAYUNIT_API_PASSWORD=<api_password>
//   supabase secrets set PAYUNIT_APP_TOKEN=<application_token>   (live_xxx or test_xxx)
//   supabase secrets set PAYUNIT_MODE=live                       (or "test" while testing)
//   supabase secrets set PAYUNIT_CURRENCY=XAF                    (PayUnit's documented currency; change only if your account is provisioned for another)
//   supabase functions deploy payunit-initiate
//   supabase functions deploy payunit-webhook
// Then in the PayUnit dashboard, set your application's notification URL to:
//   https://<project-ref>.supabase.co/functions/v1/payunit-webhook
//
// FLOW (mirrors flutterwave-initiate exactly):
//   1. The authenticated tenant owner/admin calls this function with
//      { plan_id, billing_cycle: 'monthly' | 'yearly' }.
//   2. This function verifies the caller really belongs to the tenant it
//      claims (via their JWT), looks up the plan's real price
//      server-side (never trusts a client-supplied amount), creates a
//      'pending' row in `payments`, and asks PayUnit for a hosted
//      payment link.
//   3. The browser redirects the user to that link to actually pay.
//   4. PayUnit calls payunit-webhook when the payment completes; THAT
//      function re-verifies the transaction via PayUnit's own "get
//      payment status" endpoint before granting any access -- this
//      function only ever creates a 'pending' payment, never an
//      approved one.

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

  const apiUser = Deno.env.get('PAYUNIT_API_USER');
  const apiPassword = Deno.env.get('PAYUNIT_API_PASSWORD');
  const appToken = Deno.env.get('PAYUNIT_APP_TOKEN');
  const mode = (Deno.env.get('PAYUNIT_MODE') ?? 'test').trim();
  const currency = (Deno.env.get('PAYUNIT_CURRENCY') ?? 'XAF').trim();
  if (!apiUser || !apiPassword || !appToken) {
    return json({ status: 'not_configured', message: 'PAYUNIT_API_USER / PAYUNIT_API_PASSWORD / PAYUNIT_APP_TOKEN are not set. Payment cannot be initiated until they are configured.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Use the caller's own JWT to identify them -- never trust a
  // client-supplied tenant_id without checking real membership.
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
  // the client request. NOTE: plan prices are stored in USD; PayUnit's
  // documented currency is XAF. No currency conversion is performed here
  // -- the numeric plan price is sent as-is in whatever PAYUNIT_CURRENCY
  // is configured. Confirm with PayUnit which currencies your merchant
  // account actually supports before going live.
  const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const txRef = `pu_${tenant.id}_${Date.now()}`;

  const { data: paymentRow, error: payErr } = await db.from('payments').insert({
    tenant_id: tenant.id,
    amount,
    currency,
    gateway: 'payunit',
    gateway_tx_id: txRef,
    status: 'pending',
    metadata: { plan_id: plan.id, billing_cycle },
  }).select().single();
  if (payErr) return json({ error: 'payment_row_failed', message: payErr.message }, 500);

  // redirect_url must be a trusted, configured origin -- never derived
  // from the request's Origin header (same guard as flutterwave-initiate).
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

  const returnUrl = `${redirectBase}/app/settings?billing=complete`;
  // notify_url must also be HTTPS and reachable by PayUnit's servers --
  // this is always our own Edge Function, never derived from the request.
  const notifyUrl = `${supabaseUrl}/functions/v1/payunit-webhook`;

  const puResp = await fetch('https://gateway.payunit.net/api/gateway/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${apiUser}:${apiPassword}`)}`,
      'x-api-key': appToken,
      mode,
    },
    body: JSON.stringify({
      total_amount: amount,
      currency,
      transaction_id: txRef,
      return_url: returnUrl,
      notify_url: notifyUrl,
    }),
  });

  const puData = await puResp.json();
  if (puData.status !== 'SUCCESS' || !puData.data?.transaction_url) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), payunit_error: puData } }).eq('id', paymentRow.id);
    return json({ error: 'payunit_error', message: puData.message ?? 'Failed to create payment link' }, 502);
  }

  return json({ payment_link: puData.data.transaction_url, tx_ref: txRef });
});
