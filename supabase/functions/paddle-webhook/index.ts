// Paddle webhook -- the ONLY place that grants access after a Paddle
// payment.
//
// STATUS: real, complete logic -- INACTIVE until configured (see
// paddle-initiate/index.ts header for full setup steps).
//
// SECURITY: Paddle signs every webhook request with the header
// `Paddle-Signature: ts=<unix_seconds>;h1=<hex_hmac_sha256>`, where h1
// is HMAC-SHA256(webhook_secret, "<ts>:<raw_request_body>") -- this is
// Paddle's documented verification method. This function recomputes
// that HMAC over the exact raw body bytes (before any JSON parsing) and
// only proceeds on an exact match, using a constant-time comparison so
// the check itself can't leak timing information about the secret.
// Unlike Flutterwave, Paddle does not require re-fetching the
// transaction afterwards to confirm amount/status -- the payload IS the
// signed source of truth once the signature checks out -- but this
// function still cross-checks the confirmed amount/currency against
// what was recorded when the payment was initiated, exactly like the
// other webhooks here, before granting anything.
//
// On a verified `transaction.completed` event, this is the ONLY code
// path (for Paddle payments) that sets tenants.status = 'approved' and
// tenants.plan_id -- mirrors flutterwave-webhook's access model exactly.

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

  const webhookSecret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return json({ status: 'not_configured', message: 'PADDLE_WEBHOOK_SECRET is not set.' });
  }

  const signatureHeader = req.headers.get('Paddle-Signature');
  const rawBody = await req.text();
  if (!signatureHeader) return json({ error: 'missing_signature' }, 401);

  const parts = Object.fromEntries(signatureHeader.split(';').map((p) => p.split('=') as [string, string]));
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return json({ error: 'malformed_signature' }, 401);

  const expected = await hmacSha256Hex(webhookSecret, `${ts}:${rawBody}`);
  if (!timingSafeEqual(expected, h1)) return json({ error: 'invalid_signature' }, 401);

  const payload = JSON.parse(rawBody);
  if (payload.event_type !== 'transaction.completed') {
    return json({ status: 'ignored', reason: `event_type ${payload.event_type} not handled` });
  }

  const txn = payload.data;
  const paddleTxnId = txn?.id as string | undefined;
  if (!paddleTxnId) return json({ error: 'missing_transaction_id' }, 400);

  // Amounts on Paddle transactions are strings in the currency's
  // smallest unit (e.g. cents for USD) -- our `payments.amount` is a
  // whole-unit number, matching every other gateway in this codebase.
  const grandTotalMinorUnits = Number(txn?.details?.totals?.grand_total ?? NaN);
  const verifiedAmount = Number.isFinite(grandTotalMinorUnits) ? grandTotalMinorUnits / 100 : NaN;
  const verifiedCurrency = txn?.currency_code as string | undefined;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: paymentRow } = await db.from('payments').select('*').eq('gateway_tx_id', paddleTxnId).maybeSingle();
  if (!paymentRow) return json({ error: 'payment_row_not_found', tx_ref: paddleTxnId }, 404);

  if (paymentRow.status === 'succeeded') {
    return json({ status: 'already_processed' }); // idempotent -- Paddle may retry webhooks
  }

  if (!Number.isFinite(verifiedAmount) || Math.abs(verifiedAmount - Number(paymentRow.amount)) > 0.01 || verifiedCurrency !== paymentRow.currency) {
    await db.from('payments').update({ status: 'failed', metadata: { ...(paymentRow.metadata as object), mismatch: { verifiedAmount, verifiedCurrency } } }).eq('id', paymentRow.id);
    return json({ error: 'amount_mismatch' }, 400);
  }

  const meta = paymentRow.metadata as { plan_id: string; billing_cycle: 'monthly' | 'yearly' };

  // Atomic guard against duplicate processing -- see flutterwave-webhook
  // for why this WHERE status='pending' matters under concurrent retries.
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
    payment_gateway: 'paddle',
  });

  await db.from('subscription_events').insert({
    tenant_id: paymentRow.tenant_id,
    event_type: 'payment_succeeded',
    metadata: { plan_id: meta.plan_id, billing_cycle: meta.billing_cycle, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: paddleTxnId },
  });

  return json({ status: 'ok', tenant_id: paymentRow.tenant_id });
});
