// Paystack webhook -- the ONLY place that grants access after a
// Paystack payment.
//
// STATUS: real, complete logic -- INACTIVE until configured (see
// paystack-initiate/index.ts header for setup steps).
//
// SECURITY: Paystack signs every webhook with an x-paystack-signature
// header: HMAC-SHA512 of the RAW request body, using your
// PAYSTACK_SECRET_KEY (Paystack has no separate webhook secret). This
// MUST be computed over the raw bytes before any JSON parsing, or the
// signature will never match. Even after the signature check passes,
// this function does NOT trust the webhook body's own amount/status --
// it re-verifies the transaction against Paystack's own Verify
// Transaction API (GET /transaction/verify/:reference) and only trusts
// that response, matching the same defense-in-depth pattern used for
// Flutterwave and PayUnit.
//
// On a verified successful charge, this is the ONLY code path (for
// Paystack payments) that sets tenants.status = 'approved' and
// tenants.plan_id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secretKey) {
    return json({ status: 'not_configured', message: 'PAYSTACK_SECRET_KEY not set.' });
  }

  // Read the RAW body first -- signature verification must happen over
  // the exact bytes Paystack sent, before any JSON parsing.
  const rawBody = await req.text();
  const providedSignature = req.headers.get('x-paystack-signature');
  const expectedSignature = await hmacSha512Hex(secretKey, rawBody);
  if (!providedSignature || providedSignature !== expectedSignature) {
    return json({ error: 'invalid_signature' }, 401);
  }

  const payload = JSON.parse(rawBody);
  if (payload.event !== 'charge.success') {
    return json({ status: 'ignored', reason: `event type ${payload.event} is not charge.success` });
  }

  const txRef = payload.data?.reference as string | undefined;
  if (!txRef) return json({ error: 'missing_reference' }, 400);

  // Re-verify server-side -- never trust the webhook body's own amount/
  // status claims, only what Paystack's own verify endpoint confirms.
  const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const verified = await verifyResp.json();

  if (!verified.status || verified.data?.status !== 'success') {
    return json({ status: 'ignored', reason: 'transaction not confirmed successful by Paystack verify API' });
  }

  // Paystack amounts are in the smallest currency unit -- convert back
  // to compare against the decimal amount stored in `payments`.
  const verifiedAmount = (verified.data.amount as number) / 100;
  const verifiedCurrency = verified.data.currency as string;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: paymentRow } = await db.from('payments').select('*').eq('gateway_tx_id', txRef).maybeSingle();
  if (!paymentRow) return json({ error: 'payment_row_not_found', tx_ref: txRef }, 404);

  if (paymentRow.status === 'succeeded') {
    return json({ status: 'already_processed' }); // idempotent -- Paystack may retry webhooks
  }

  if (Number(verifiedAmount) !== Number(paymentRow.amount) || verifiedCurrency !== paymentRow.currency) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), mismatch: verified.data } }).eq('id', paymentRow.id);
    return json({ error: 'amount_mismatch' }, 400);
  }

  const meta = paymentRow.metadata as { plan_id: string; billing_cycle: 'monthly' | 'yearly' };

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
    payment_gateway: 'paystack',
  });

  await db.from('subscription_events').insert({
    tenant_id: paymentRow.tenant_id,
    event_type: 'payment_succeeded',
    metadata: { plan_id: meta.plan_id, billing_cycle: meta.billing_cycle, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: txRef },
  });

  return json({ status: 'ok', tenant_id: paymentRow.tenant_id });
});
