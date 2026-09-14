// Stripe webhook -- the ONLY place that grants access after a Stripe
// payment.
//
// STATUS: real, complete logic -- INACTIVE until configured (see
// stripe-initiate/index.ts header for full setup steps).
//
// SECURITY: Stripe signs every webhook request with the header
// `Stripe-Signature: t=<unix_seconds>,v1=<hex_hmac_sha256>[,v0=...]`,
// where v1 is HMAC-SHA256(webhook_secret, "<t>.<raw_request_body>") --
// Stripe's documented verification method. This recomputes that HMAC
// over the exact raw body bytes (before any JSON parsing) and only
// proceeds on an exact match, using a constant-time comparison, exactly
// mirroring paddle-webhook's approach for the same class of signature
// scheme. The event's own `amount_total`/currency are still cross-
// checked against what was recorded when the payment was initiated,
// exactly like the other webhooks here, before granting anything --
// signature validity proves the event came from Stripe, not that it
// matches the payment we expect.
//
// On a verified `checkout.session.completed` event with
// payment_status = 'paid', this is the ONLY code path (for Stripe
// payments) that sets tenants.status = 'approved' and tenants.plan_id
// -- mirrors flutterwave-webhook's access model exactly.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return json({ status: 'not_configured', message: 'STRIPE_WEBHOOK_SECRET is not set.' });
  }

  const signatureHeader = req.headers.get('Stripe-Signature');
  const rawBody = await req.text();
  if (!signatureHeader) return json({ error: 'missing_signature' }, 401);

  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=') as [string, string]));
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return json({ error: 'malformed_signature' }, 401);

  // Reject stale/replayed deliveries -- Stripe recommends a 5 minute
  // tolerance window on the timestamp.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return json({ error: 'stale_signature' }, 401);

  const expected = await hmacSha256Hex(webhookSecret, `${ts}.${rawBody}`);
  if (!timingSafeEqual(expected, v1)) return json({ error: 'invalid_signature' }, 401);

  const event = JSON.parse(rawBody);
  if (event.type !== 'checkout.session.completed') {
    return json({ status: 'ignored', reason: `event type ${event.type} not handled` });
  }

  const session = event.data?.object;
  if (session?.payment_status !== 'paid') {
    return json({ status: 'ignored', reason: 'payment_status is not paid' });
  }

  const txRef = session.client_reference_id as string | undefined;
  const verifiedAmount = (session.amount_total ?? 0) / 100;
  const verifiedCurrency = String(session.currency ?? '').toUpperCase();
  if (!txRef) return json({ error: 'missing_client_reference_id' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: paymentRow } = await db.from('payments').select('*').eq('gateway_tx_id', txRef).maybeSingle();
  if (!paymentRow) return json({ error: 'payment_row_not_found', tx_ref: txRef }, 404);

  if (paymentRow.status === 'succeeded') {
    return json({ status: 'already_processed' }); // idempotent -- Stripe retries webhooks
  }

  if (Number(verifiedAmount) !== Number(paymentRow.amount) || verifiedCurrency !== paymentRow.currency) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), mismatch: { amount: verifiedAmount, currency: verifiedCurrency } } }).eq('id', paymentRow.id);
    return json({ error: 'amount_mismatch' }, 400);
  }

  const meta = paymentRow.metadata as { plan_id: string; billing_cycle: 'monthly' | 'yearly' };

  // Atomic guard against duplicate processing -- see flutterwave-webhook
  // for the full reasoning; identical pattern here.
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
    payment_gateway: 'stripe',
  });

  await db.from('subscription_events').insert({
    tenant_id: paymentRow.tenant_id,
    event_type: 'payment_succeeded',
    metadata: { plan_id: meta.plan_id, billing_cycle: meta.billing_cycle, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: txRef },
  });

  return json({ status: 'ok', tenant_id: paymentRow.tenant_id });
});
