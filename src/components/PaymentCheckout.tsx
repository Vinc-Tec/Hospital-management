import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { getAvailableGateways, initiateWithGateway, GATEWAY_LABELS } from '../lib/payments';
import { openPaddleCheckout } from '../lib/paddle';
import { Modal, Button } from './ui';

// One hook, used by both the expired-trial billing screen and the
// in-app Settings > Billing plan picker, so the "check availability,
// auto-select or show a picker" logic lives in exactly one place.
//
// Usage:
//   const checkout = usePaymentCheckout();
//   <Button onClick={() => checkout.start(planId, billingCycle)}>...</Button>
//   {checkout.modal}
export function usePaymentCheckout() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ gateways: string[]; planId: string; billingCycle: 'monthly' | 'yearly'; token: string } | null>(null);

  const handleResult = async (result: Awaited<ReturnType<typeof initiateWithGateway>>) => {
    if (result.ok && result.kind === 'redirect') {
      // Real access change happens server-side in the matching webhook
      // once the gateway confirms payment -- this redirect just takes
      // the admin to actually pay, it does not grant anything itself.
      window.location.href = result.payment_link;
      return true;
    }
    if (result.ok && result.kind === 'overlay') {
      // Same principle as the redirect case: opening the overlay never
      // grants anything by itself -- paddle-webhook is still the only
      // thing that does, once Paddle confirms the transaction.
      try {
        await openPaddleCheckout(result.paddlePriceId, result.customData);
        return true;
      } catch {
        setError(t('billing.error_generic'));
        return false;
      }
    }
    if (!result.ok && result.reason === 'no_gateway_configured') setError(t('billing.error_not_configured'));
    else if (!result.ok && result.reason === 'no_session') setError(t('billing.error_no_session'));
    else if (!result.ok) setError(result.message || t('billing.error_generic'));
    return false;
  };

  const start = async (planId: string, billingCycle: 'monthly' | 'yearly') => {
    setLoading(true); setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setLoading(false); setError(t('billing.error_no_session')); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const gateways = await getAvailableGateways(supabaseUrl);

    if (gateways.length === 0) {
      setLoading(false);
      setError(t('billing.error_not_configured'));
      return;
    }

    if (gateways.length === 1) {
      const result = await initiateWithGateway(supabaseUrl, token, planId, billingCycle, gateways[0]);
      setLoading(false);
      await handleResult(result);
      return;
    }

    // More than one gateway available -- let the customer pick.
    setLoading(false);
    setPicker({ gateways, planId, billingCycle, token });
  };

  const choose = async (gateway: string) => {
    if (!picker) return;
    setLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const result = await initiateWithGateway(supabaseUrl, picker.token, picker.planId, picker.billingCycle, gateway);
    setLoading(false);
    setPicker(null);
    await handleResult(result);
  };

  const modal = (
    <Modal
      open={!!picker}
      onClose={() => setPicker(null)}
      title={t('billing.choose_gateway')}
    >
      <div className="space-y-2">
        {picker?.gateways.map((g) => (
          <Button key={g} variant="outline" className="w-full justify-center" disabled={loading} onClick={() => choose(g)}>
            {GATEWAY_LABELS[g] ?? g}
          </Button>
        ))}
      </div>
    </Modal>
  );

  return { start, loading, error, modal };
}
