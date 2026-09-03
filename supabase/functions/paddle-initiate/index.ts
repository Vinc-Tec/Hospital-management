// Paddle checkout initiation
//
// STATUS: real, complete logic -- INACTIVE until you configure Paddle
// credentials AND a price map. Without them, returns a clear
// 'not_configured' response rather than failing confusingly.
//
// WHY PADDLE: unlike the other gateways here, Paddle is a Merchant of
// Record -- it becomes the seller of record for every transaction and
// automatically calculates, collects and remits sales tax/VAT/GST in
// every jurisdiction it supports. That's the right fit for selling a
// SaaS subscription internationally without registering for tax
// collection in every country yourself.
//
// SETUP (once you have a Paddle account -- paddle.com):
//   1. Paddle Dashboard > Catalog > Products: create one product with a
//      recurring Price for each (plan, billing_cycle) combination you
//      sell (Starter monthly, Starter yearly, Professional monthly, …).
//      Unlike Flutterwave/PayUnit, Paddle bills off pre-created Price
//      objects, not an arbitrary amount passed at checkout time.
//   2. Paddle Dashboard > Developer Tools > Authentication: create an
//      API key.
//   3. Paddle Dashboard > Developer Tools > Notifications: create a
//      destination pointed at
//      https://<project-ref>.supabase.co/functions/v1/paddle-webhook,
//      subscribed to at least `transaction.completed`, and copy its
//      secret key.
//   4. supabase secrets set PADDLE_API_KEY=pdl_...
//      supabase secrets set PADDLE_WEBHOOK_SECRET=ntfset_...
//      supabase secrets set PADDLE_ENV=sandbox   # or: production
//      supabase secrets set PADDLE_PRICE_MAP='{"starter:monthly":"pri_xxx","starter:yearly":"pri_yyy","professional:monthly":"pri_xxx", ...}'
//      supabase functions deploy paddle-initiate
//      supabase functions deploy paddle-webhook
//   The PADDLE_PRICE_MAP key is "<plan code>:<monthly|yearly>" -- plan
//   codes are the subscription_plans.code values (starter, professional,
//   business, enterprise).
//
// FLOW: same shape as flutterwave-initiate -- verifies the caller's real
// tenant membership, looks up the plan's price server-side (as a Paddle
// price_id, not a raw amount), creates a 'pending' row in `payments`,
// and asks Paddle for a hosted checkout link. paddle-webhook is the only
// place that grants access, after verifying Paddle's signature.

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

  const apiKey = Deno.env.get('PADDLE_API_KEY');
  const priceMapRaw = Deno.env.get('PADDLE_PRICE_MAP');
  if (!apiKey || !priceMapRaw) {
    return json({ status: 'not_configured', message: 'PADDLE_API_KEY / PADDLE_PRICE_MAP are not set. Payment cannot be initiated until they are configured.' });
  }

  let priceMap: Record<string, string>;
  try {
    priceMap = JSON.parse(priceMapRaw);
  } catch {
    return json({ status: 'not_configured', message: 'PADDLE_PRICE_MAP is not valid JSON.' });
  }

  const paddleEnv = (Deno.env.get('PADDLE_ENV') ?? 'sandbox').trim();
  const apiBase = paddleEnv === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';

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

  const { data: plan, error: planErr } = await db.from('subscription_plans').select('id, code, name, price_monthly, price_yearly').eq('id', plan_id).eq('is_active', true).maybeSingle();
  if (planErr || !plan) return json({ error: 'plan_not_found' }, 404);

  const priceId = priceMap[`${plan.code}:${billing_cycle}`];
  if (!priceId) {
    return json({ status: 'not_configured', message: `No Paddle price_id configured for "${plan.code}:${billing_cycle}" in PADDLE_PRICE_MAP.` });
  }

  const { data: tenant } = await db.from('tenants').select('id, legal_name, email, commercial_name').eq('id', membership.tenant_id).maybeSingle();
  if (!tenant) return json({ error: 'tenant_not_found' }, 404);

  const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

  const { data: paymentRow, error: payErr } = await db.from('payments').insert({
    tenant_id: tenant.id,
    amount,
    currency: 'USD',
    gateway: 'paddle',
    gateway_tx_id: null, // filled in once Paddle returns its own transaction id, below
    status: 'pending',
    metadata: { plan_id: plan.id, billing_cycle },
  }).select().single();
  if (payErr) return json({ error: 'payment_row_failed', message: payErr.message }, 500);

  const paddleResp = await fetch(`${apiBase}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      checkout: {}, // ask Paddle for a hosted checkout.url in the response
      custom_data: { payment_id: paymentRow.id, tenant_id: tenant.id, plan_id: plan.id, billing_cycle },
    }),
  });

  const paddleData = await paddleResp.json();
  if (!paddleResp.ok || !paddleData?.data?.id) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), paddle_error: paddleData } }).eq('id', paymentRow.id);
    return json({ error: 'paddle_error', message: paddleData?.error?.detail ?? 'Failed to create Paddle transaction' }, 502);
  }

  // Now that Paddle has issued its own transaction id, store it as the
  // key the webhook will match this payment row on.
  await db.from('payments').update({ gateway_tx_id: paddleData.data.id }).eq('id', paymentRow.id);

  const checkoutUrl = paddleData.data.checkout?.url;
  if (!checkoutUrl) {
    return json({ error: 'no_checkout_url', message: 'Paddle did not return a checkout.url -- a default payment link/approved domain must be configured in the Paddle dashboard.' }, 502);
  }

  return json({ payment_link: checkoutUrl, tx_ref: paddleData.data.id });
});
