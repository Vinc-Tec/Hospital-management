// Flutterwave checkout initiation
//
// STATUS: real, complete logic -- INACTIVE until you configure a
// Flutterwave secret key. Without it, returns a clear 'not_configured'
// response rather than failing confusingly or faking a payment link.
//
// SETUP (once you have a Flutterwave account):
//   supabase secrets set FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxx
//   supabase functions deploy flutterwave-initiate
//   supabase functions deploy flutterwave-webhook
// Then in the Flutterwave dashboard, set the webhook URL to:
//   https://<project-ref>.supabase.co/functions/v1/flutterwave-webhook
// and set a "Secret Hash" there -- also store that exact value as:
//   supabase secrets set FLUTTERWAVE_WEBHOOK_SECRET=<the same secret hash>
//
// FLOW:
//   1. The authenticated tenant owner/admin calls this function with
//      { plan_id, billing_cycle: 'monthly' | 'yearly' } (see the matching
//      frontend change in Billing.tsx).
//   2. This function verifies the caller really belongs to the tenant it
//      claims (via their JWT, not just a client-supplied tenant_id),
//      looks up the plan's real price server-side (never trusts a
//      client-supplied amount), creates a 'pending' row in `payments`,
//      and asks Flutterwave for a hosted payment link.
//   3. The browser redirects the user to that link to actually pay.
//   4. Flutterwave calls flutterwave-webhook when the payment completes;
//      THAT function is what actually grants access, after re-verifying
//      the transaction server-side -- this function only ever creates a
//      'pending' payment, never an approved one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!secretKey) {
    return json({ status: 'not_configured', message: 'FLUTTERWAVE_SECRET_KEY is not set. Payment cannot be initiated until it is configured.' });
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
  // the client request.
  const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const txRef = `hc_${tenant.id}_${Date.now()}`;

  const { data: paymentRow, error: payErr } = await db.from('payments').insert({
    tenant_id: tenant.id,
    amount,
    currency: 'USD',
    gateway: 'flutterwave',
    gateway_tx_id: txRef,
    status: 'pending',
    metadata: { plan_id: plan.id, billing_cycle },
  }).select().single();
  if (payErr) return json({ error: 'payment_row_failed', message: payErr.message }, 500);

  const origin = req.headers.get('origin') ?? '';
  const flwResp = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency: 'USD',
      redirect_url: `${origin}/app/settings?billing=complete`,
      customer: {
        email: tenant.email,
        name: tenant.commercial_name || tenant.legal_name,
      },
      customizations: {
        title: 'Health Cloud',
        description: `${plan.name} plan — ${billing_cycle}`,
      },
      meta: { payment_id: paymentRow.id, tenant_id: tenant.id, plan_id: plan.id, billing_cycle },
    }),
  });

  const flwData = await flwResp.json();
  if (flwData.status !== 'success') {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), flutterwave_error: flwData } }).eq('id', paymentRow.id);
    return json({ error: 'flutterwave_error', message: flwData.message ?? 'Failed to create payment link' }, 502);
  }

  return json({ payment_link: flwData.data.link, tx_ref: txRef });
});
