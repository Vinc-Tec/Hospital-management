// Paddle checkout preparation
//
// STATUS: real, complete logic -- INACTIVE until PADDLE_PRICE_MAP is
// configured (see below). No PADDLE_API_KEY is needed for this flow:
// only a client-side token (see src/lib/paddle.ts), which is what was
// actually provided for this integration. Paddle's client-side token
// can open a checkout overlay directly, but it cannot create database
// rows -- so this function does the one thing that still has to happen
// server-side: verify the caller really belongs to the tenant they're
// paying for, look up which Paddle price_id corresponds to the plan
// they picked, and record a 'pending' row in `payments` (only
// super-admin/service-role may INSERT into payments -- see RLS policy
// "pay_insert" -- so a tenant member cannot forge this from the
// browser). The frontend then opens Paddle's own checkout overlay with
// that price_id. paddle-webhook remains the ONLY place that grants
// access, once Paddle confirms the transaction server-side.
//
// SETUP (once you have a Paddle account -- paddle.com):
//   1. Paddle Dashboard > Catalog > Products: create one product with a
//      recurring Price for each (plan, billing_cycle) you sell.
//   2. Paddle Dashboard > Developer Tools > Notifications: create a
//      destination pointed at
//      https://<project-ref>.supabase.co/functions/v1/paddle-webhook,
//      subscribed to at least `transaction.completed`, and copy its
//      secret key.
//   3. supabase secrets set PADDLE_WEBHOOK_SECRET=ntfset_...
//      supabase secrets set PADDLE_PRICE_MAP='{"starter:monthly":"pri_xxx","starter:yearly":"pri_yyy", ...}'
//      supabase functions deploy paddle-initiate
//      supabase functions deploy paddle-webhook
//   4. Set VITE_PADDLE_CLIENT_TOKEN (and VITE_PADDLE_ENV=sandbox while
//      testing) wherever the frontend's build-time env vars live --
//      this is the public, frontend-safe token, not a secret.
//   The PADDLE_PRICE_MAP key is "<plan code>:<monthly|yearly>" -- plan
//   codes are subscription_plans.code (starter, professional, business,
//   enterprise).

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

  const priceMapRaw = Deno.env.get('PADDLE_PRICE_MAP');
  if (!priceMapRaw) {
    return json({ status: 'not_configured', message: 'PADDLE_PRICE_MAP is not set. Payment cannot be initiated until it is configured.' });
  }

  let priceMap: Record<string, string>;
  try {
    priceMap = JSON.parse(priceMapRaw);
  } catch {
    return json({ status: 'not_configured', message: 'PADDLE_PRICE_MAP is not valid JSON.' });
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

  const { data: plan, error: planErr } = await db.from('subscription_plans').select('id, code, price_monthly, price_yearly').eq('id', plan_id).eq('is_active', true).maybeSingle();
  if (planErr || !plan) return json({ error: 'plan_not_found' }, 404);

  const priceId = priceMap[`${plan.code}:${billing_cycle}`];
  if (!priceId) {
    return json({ status: 'not_configured', message: `No Paddle price_id configured for "${plan.code}:${billing_cycle}" in PADDLE_PRICE_MAP.` });
  }

  const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

  const { data: paymentRow, error: payErr } = await db.from('payments').insert({
    tenant_id: membership.tenant_id,
    amount,
    currency: 'USD',
    gateway: 'paddle',
    gateway_tx_id: null, // Paddle only issues its own transaction id once checkout completes; paddle-webhook matches back to this row via custom_data.payment_id instead.
    status: 'pending',
    metadata: { plan_id: plan.id, billing_cycle },
  }).select().single();
  if (payErr) return json({ error: 'payment_row_failed', message: payErr.message }, 500);

  return json({
    paddle_price_id: priceId,
    payment_id: paymentRow.id,
    tenant_id: membership.tenant_id,
    plan_id: plan.id,
    billing_cycle,
  });
});
