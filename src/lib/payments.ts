// Shared payment initiation. The app supports multiple gateways
// (PayUnit, Flutterwave, Paystack, Paddle), all pricing plans in USD.
// Rather than always asking the customer which to use: if exactly one
// gateway is configured, it's used automatically; if more than one is
// configured, the caller (see components/PaymentCheckout.tsx) shows a
// small picker so the customer chooses which one suits them.

import { isPaddleConfigured } from './paddle';

export const GATEWAY_LABELS: Record<string, string> = {
  payunit: 'PayUnit',
  flutterwave: 'Flutterwave',
  paystack: 'Paystack',
  paddle: 'Paddle',
};

export type InitiatePaymentResult =
  | { ok: true; kind: 'redirect'; payment_link: string; gateway: string }
  | { ok: true; kind: 'overlay'; gateway: 'paddle'; paddlePriceId: string; customData: Record<string, string> }
  | { ok: false; reason: 'no_session' }
  | { ok: false; reason: 'no_gateway_configured' }
  | { ok: false; reason: 'error'; message: string };

// Checks which gateways currently have credentials configured. Never
// touches tenant data and needs no auth -- it only reveals which
// secrets exist, not their values.
export async function getAvailableGateways(supabaseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/payment-gateway-status`);
    const data = await res.json();
    return Object.entries(data)
      .filter(([gateway, isAvailable]) => {
        if (!isAvailable) return false;
        // Paddle also needs its public client-side token configured in
        // *this* build (see src/lib/paddle.ts) -- the server only knows
        // whether PADDLE_PRICE_MAP is set, so without this check a
        // deployment with the price map but no client token would offer
        // Paddle and then fail the moment the overlay tried to open.
        if (gateway === 'paddle') return isPaddleConfigured();
        return true;
      })
      .map(([gateway]) => gateway);
  } catch {
    return [];
  }
}

export async function initiateWithGateway(
  supabaseUrl: string,
  token: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly',
  gateway: string
): Promise<InitiatePaymentResult> {
  if (!token) return { ok: false, reason: 'no_session' };

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${gateway}-initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
    });
    const data = await res.json();

    if (data.status === 'not_configured') return { ok: false, reason: 'no_gateway_configured' };

    // Paddle's client-side token opens an in-browser checkout overlay
    // (see src/lib/paddle.ts) instead of redirecting to a hosted page
    // like every other gateway here -- so its -initiate response shape
    // is different: a price_id + custom_data to hand to Paddle.js,
    // rather than a payment_link.
    if (gateway === 'paddle') {
      if (!res.ok || !data.paddle_price_id) return { ok: false, reason: 'error', message: data.message ?? 'paddle returned an error' };
      return {
        ok: true,
        kind: 'overlay',
        gateway: 'paddle',
        paddlePriceId: data.paddle_price_id,
        customData: { payment_id: data.payment_id, tenant_id: data.tenant_id, plan_id: data.plan_id, billing_cycle: data.billing_cycle },
      };
    }

    if (!res.ok || !data.payment_link) return { ok: false, reason: 'error', message: data.message ?? `${gateway} returned an error` };

    return { ok: true, kind: 'redirect', payment_link: data.payment_link, gateway };
  } catch {
    return { ok: false, reason: 'error', message: `${gateway} request failed` };
  }
}
