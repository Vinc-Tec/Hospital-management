// Shared payment initiation: the app supports multiple gateways
// (Flutterwave, PayUnit) that are both international, so the customer
// is never asked to pick one -- this tries them in order and silently
// falls back to the next if a gateway isn't configured yet, returning
// the first working payment link.

const GATEWAY_ORDER: readonly string[] = ['payunit', 'flutterwave'];

export type InitiatePaymentResult =
  | { ok: true; payment_link: string; gateway: string }
  | { ok: false; reason: 'no_session' }
  | { ok: false; reason: 'no_gateway_configured' }
  | { ok: false; reason: 'error'; message: string };

export async function initiatePayment(
  supabaseUrl: string,
  token: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<InitiatePaymentResult> {
  if (!token) return { ok: false, reason: 'no_session' };

  let lastError: string | null = null;

  for (const gateway of GATEWAY_ORDER) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${gateway}-initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      const data = await res.json();

      if (data.status === 'not_configured') continue; // try the next gateway silently

      if (!res.ok || !data.payment_link) {
        lastError = data.message ?? `${gateway} returned an error`;
        continue; // a configured gateway failed this attempt -- still try the other before giving up
      }

      return { ok: true, payment_link: data.payment_link, gateway };
    } catch {
      lastError = `${gateway} request failed`;
    }
  }

  if (lastError) return { ok: false, reason: 'error', message: lastError };
  return { ok: false, reason: 'no_gateway_configured' };
}
