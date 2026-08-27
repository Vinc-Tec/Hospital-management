// PayUnit webhook -- the ONLY place that grants access after a PayUnit
// payment.
//
// STATUS: real, complete logic -- INACTIVE until configured (see
// payunit-initiate/index.ts header for full setup steps).
//
// SECURITY: PayUnit's documented notify_url payload is not
// cryptographically signed the way Stripe's is. This function does NOT
// trust anything in the webhook body about the payment's outcome -- it
// only uses the body to extract a transaction id, then re-verifies that
// transaction directly against PayUnit's own "Get payment status"
// endpoint (GET {BASE_URL}/api/gateway/paymentstatus/{transactionID}),
// authenticated with the same server-side credentials used to initiate
// the payment. Only that response's amount/currency/status are trusted.
// This mirrors flutterwave-webhook's verification model and prevents a
// forged or replayed notification from being trusted.
//
// On a verified successful charge, this is the ONLY code path (for
// PayUnit payments) that sets tenants.status = 'approved' and
// tenants.plan_id -- the tenant owner's own RLS permissions are
// deliberately restricted (see close_tenant_self_approval_gap /
// block_trial_extension_bypass) so they cannot do this themselves; only
// this webhook (running as the service role) and super admins can.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiUser = Deno.env.get('PAYUNIT_API_USER');
  const apiPassword = Deno.env.get('PAYUNIT_API_PASSWORD');
  const appToken = Deno.env.get('PAYUNIT_APP_TOKEN');
  const mode = (Deno.env.get('PAYUNIT_MODE') ?? 'test').trim();
  if (!apiUser || !apiPassword || !appToken) {
    return json({ status: 'not_configured', message: 'PAYUNIT_API_USER / PAYUNIT_API_PASSWORD / PAYUNIT_APP_TOKEN not set.' });
  }

  // PayUnit's exact notify_url payload shape isn't guaranteed, so this
  // looks for the transaction id in every plausible location rather than
  // assuming one fixed structure -- it is only ever used to look up the
  // transaction via PayUnit's own status endpoint below, never trusted
  // for anything else in the payload.
  const payload = await req.json().catch(() => ({}));
  const txRef =
    payload?.transaction_id ?? payload?.data?.transaction_id ?? payload?.transactionId ?? null;
  if (!txRef) return json({ error: 'missing_transaction_id' }, 400);

  // Re-verify server-side -- never trust the webhook body's own amount/
  // status claims, only what PayUnit's own status endpoint confirms.
  const statusResp = await fetch(`https://gateway.payunit.net/api/gateway/paymentstatus/${encodeURIComponent(txRef)}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${apiUser}:${apiPassword}`)}`,
      'x-api-key': appToken,
      mode,
    },
  });
  const verified = await statusResp.json();

  if (verified.status !== 'SUCCESS' || verified.data?.transaction_status !== 'SUCCESS') {
    return json({ status: 'ignored', reason: 'transaction not confirmed successful by PayUnit status API' });
  }

  const verifiedAmount = verified.data.transaction_amount as number;
  const verifiedCurrency = verified.data.transaction_currency as string;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: paymentRow } = await db.from('payments').select('*').eq('gateway_tx_id', txRef).maybeSingle();
  if (!paymentRow) return json({ error: 'payment_row_not_found', tx_ref: txRef }, 404);

  if (paymentRow.status === 'succeeded') {
    return json({ status: 'already_processed' }); // idempotent -- PayUnit may retry notifications
  }

  // The amount/currency actually confirmed by PayUnit must match what we
  // recorded when initiating the payment.
  if (Number(verifiedAmount) !== Number(paymentRow.amount) || verifiedCurrency !== paymentRow.currency) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), mismatch: verified.data } }).eq('id', paymentRow.id);
    return json({ error: 'amount_mismatch' }, 400);
  }

  const meta = paymentRow.metadata as { plan_id: string; billing_cycle: 'monthly' | 'yearly' };

  // Atomic guard against duplicate processing (same pattern as
  // flutterwave-webhook): only proceed if this update actually flips a
  // still-'pending' row.
  const { data: updatedRows } = await db.from('payments')
    .update({ status: 'succeeded', paid_at: new Date().toISOString() })
    .eq('id', paymentRow.id).eq('status', 'pending').select('id');
  if (!updatedRows || updatedRows.length === 0) {
    return json({ status: 'already_processed' });
  }

  await db.from('tenants').update({ status: 'approved', plan_id: meta.plan_id }).eq('id', paymentRow.tenant_id);

  const startDate = new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (meta.billing_cycle === 'yearly' ? 365 : 30));

  // Replace any prior active subscription for this tenant with the new one.
  await db.from('tenant_subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'superseded by new payment' })
    .eq('tenant_id', paymentRow.tenant_id)
    .eq('status', 'active');

  await db.from('tenant_subscriptions').insert({
    tenant_id: paymentRow.tenant_id,
    plan_id: meta.plan_id,
    billing_cycle: meta.billing_cycle,
    start_date: startDate,
    end_date: endDate.toISOString().slice(0, 10),
    next_billing_date: endDate.toISOString().slice(0, 10),
    status: 'active',
    payment_gateway: 'payunit',
  });

  await db.from('subscription_events').insert({
    tenant_id: paymentRow.tenant_id,
    event_type: 'payment_succeeded',
    metadata: { plan_id: meta.plan_id, billing_cycle: meta.billing_cycle, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: txRef },
  });

  return json({ status: 'ok', tenant_id: paymentRow.tenant_id });
});
