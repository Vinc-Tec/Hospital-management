// Flutterwave webhook -- the ONLY place that grants access after payment
//
// STATUS: real, complete logic -- INACTIVE until configured (see
// flutterwave-initiate/index.ts header for full setup steps).
//
// SECURITY: Flutterwave's webhook payload is not cryptographically
// signed the way Stripe's is -- it's protected by a shared secret sent
// in the `verif-hash` header, which must match FLUTTERWAVE_WEBHOOK_SECRET
// exactly. That check alone is necessary but not sufficient: this
// function ALSO re-verifies the transaction directly against
// Flutterwave's Verify Transaction API using the transaction id from the
// payload, and only trusts THAT response's amount/currency/status --
// never the webhook body's own claims about them. This is Flutterwave's
// documented best practice and prevents a forged or replayed webhook
// call (even one with a correct hash) from being trusted on stale or
// tampered amounts.
//
// On a verified successful charge, this is the ONLY code path that sets
// tenants.status = 'approved' and tenants.plan_id -- the tenant owner's
// own RLS permissions were deliberately restricted (see the
// close_tenant_self_approval_gap migration) so they cannot do this
// themselves; only this webhook (running as the service role) and super
// admins can.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const webhookSecret = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET');
  const secretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!webhookSecret || !secretKey) {
    return json({ status: 'not_configured', message: 'FLUTTERWAVE_WEBHOOK_SECRET / FLUTTERWAVE_SECRET_KEY not set.' });
  }

  const providedHash = req.headers.get('verif-hash');
  if (!providedHash || providedHash !== webhookSecret) {
    return json({ error: 'invalid_signature' }, 401);
  }

  const payload = await req.json();
  const flwTransactionId = payload?.data?.id;
  if (!flwTransactionId) return json({ error: 'missing_transaction_id' }, 400);

  // Re-verify server-side -- never trust the webhook body's own amount/
  // status claims, only what Flutterwave's own verify endpoint confirms.
  const verifyResp = await fetch(`https://api.flutterwave.com/v3/transactions/${flwTransactionId}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const verified = await verifyResp.json();

  if (verified.status !== 'success' || verified.data?.status !== 'successful') {
    return json({ status: 'ignored', reason: 'transaction not confirmed successful by Flutterwave verify API' });
  }

  const txRef = verified.data.tx_ref as string;
  const verifiedAmount = verified.data.amount as number;
  const verifiedCurrency = verified.data.currency as string;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: paymentRow } = await db.from('payments').select('*').eq('gateway_tx_id', txRef).maybeSingle();
  if (!paymentRow) return json({ error: 'payment_row_not_found', tx_ref: txRef }, 404);

  if (paymentRow.status === 'succeeded') {
    return json({ status: 'already_processed' }); // idempotent -- Flutterwave may retry webhooks
  }

  // The amount/currency actually confirmed by Flutterwave must match what
  // we recorded when initiating the payment -- guards against a tampered
  // or mismatched transaction being matched to this payment row.
  if (Number(verifiedAmount) !== Number(paymentRow.amount) || verifiedCurrency !== paymentRow.currency) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), mismatch: verified.data } }).eq('id', paymentRow.id);
    return json({ error: 'amount_mismatch' }, 400);
  }

  const meta = paymentRow.metadata as { plan_id: string; billing_cycle: 'monthly' | 'yearly' };

  await db.from('payments').update({ status: 'succeeded', paid_at: new Date().toISOString() }).eq('id', paymentRow.id);

  // This is the one and only place in the whole codebase that sets a
  // tenant's status to 'approved' with a plan_id, following a real,
  // re-verified payment.
  await db.from('tenants').update({ status: 'approved', plan_id: meta.plan_id }).eq('id', paymentRow.tenant_id);

  const startDate = new Date().toISOString().slice(0, 10);
  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + (meta.billing_cycle === 'yearly' ? 12 : 1));

  await db.from('tenant_subscriptions').insert({
    tenant_id: paymentRow.tenant_id,
    plan_id: meta.plan_id,
    billing_cycle: meta.billing_cycle,
    start_date: startDate,
    status: 'active',
    payment_gateway: 'flutterwave',
    next_billing_date: nextBilling.toISOString().slice(0, 10),
  });

  return json({ status: 'ok', tenant_id: paymentRow.tenant_id });
});
