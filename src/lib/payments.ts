// Shared payment initiation. The app supports multiple gateways
// (PayUnit, Flutterwave, Paystack), all pricing plans in USD. Rather
// than always asking the customer which to use: if exactly one gateway
// is configured, it's used automatically; if more than one is
// configured, the caller (see components/PaymentGatewayModal.tsx) shows
// a small picker so the customer chooses which one suits them.

export const GATEWAY_LABELS: Record<string, string> = {
  payunit: 'PayUnit',
  flutterwave: 'Flutterwave',
  paystack: 'Paystack',
};

export type InitiatePaymentResult =
  | { ok: true; payment_link: string; gateway: string }
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
      .filter(([, isAvailable]) => isAvailable)
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
    if (!res.ok || !data.payment_link) return { ok: false, reason: 'error', message: data.message ?? `${gateway} returned an error` };

    return { ok: true, payment_link: data.payment_link, gateway };
  } catch {
    return { ok: false, reason: 'error', message: `${gateway} request failed` };
  }
}
