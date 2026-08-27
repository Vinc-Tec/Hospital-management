import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, CreditCard, AlertCircle, Clock, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type SubscriptionPlan } from '../lib/supabase';
import { initiatePayment } from '../lib/payments';
import { Logo, CopyrightLine } from '../components/brand';

type AccessState = 'loading' | 'ok' | 'grace' | 'expired';

const GRACE_DAYS_DEFAULT = 3;



function useAccessState(): { state: AccessState; daysLeft: number; graceDaysLeft: number } {
  const { activeTenant } = useAuth();
  const [state, setState] = useState<AccessState>('loading');
  const [daysLeft, setDaysLeft] = useState(0);
  const [graceDaysLeft, setGraceDaysLeft] = useState(0);

  useEffect(() => {
    if (!activeTenant) { setState('ok'); return; }
    const now = new Date();
    const trialEnd = new Date(activeTenant.trial_ends_at);
    const trialDaysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (activeTenant.status === 'approved' && activeTenant.plan_id) {
      setState('ok'); return;
    }
    if (trialDaysLeft > 0) {
      setState('ok');
      setDaysLeft(trialDaysLeft);
      return;
    }
    if (activeTenant.grace_period_ends_at) {
      const graceEnd = new Date(activeTenant.grace_period_ends_at);
      const graceDays = Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (graceDays > 0) {
        setState('grace');
        setGraceDaysLeft(graceDays);
        return;
      }
    } else {
      const graceEnd = new Date(trialEnd);
      graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS_DEFAULT);
      const graceDays = Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (graceDays > 0) {
        setState('grace');
        setGraceDaysLeft(graceDays);
        return;
      }
    }
    setState('expired');
  }, [activeTenant]);

  return { state, daysLeft, graceDaysLeft };
}

export function TrialBanner() {
  const { daysLeft } = useAccessState();
  const { t } = useI18n();
  const { profile } = useAuth();
  if (profile?.is_super_admin) return null;
  if (daysLeft <= 0 || daysLeft > 7) return null;
  const urgent = daysLeft <= 3;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${urgent ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
      <div className="flex items-center gap-2">
        <Clock size={15} />
        <span className="font-medium">{t('billing.trial_banner').replace('{n}', String(daysLeft))}</span>
      </div>
      <Link to="/app/settings" className="text-xs underline font-semibold opacity-90 hover:opacity-100">{t('billing.subscribe_now')}</Link>
    </div>
  );
}

export function BillingGate({ children }: { children: React.ReactNode }) {
  const { state, graceDaysLeft } = useAccessState();
  const { profile } = useAuth();

  // Super admins bypass all subscription requirements
  if (profile?.is_super_admin) return <>{children}</>;

  if (state === 'loading') return null;
  if (state === 'ok') return <>{children}</>;
  if (state === 'grace') return <GracePeriodScreen daysLeft={graceDaysLeft} />;
  return <SubscriptionScreen />;
}

function GracePeriodScreen({ daysLeft }: { daysLeft: number }) {
  const { t } = useI18n();
  const { activeTenant, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    if (!activeTenant) return;
    setExporting(true);
    const tables = ['patients', 'doctors', 'appointments', 'invoices', 'medical_records', 'prescriptions'];
    const bundle: Record<string, unknown> = { exported_at: new Date().toISOString(), tenant: activeTenant.legal_name };
    for (const table of tables) {
      const { data } = await supabase.from(table).select('*').eq('tenant_id', activeTenant.id).limit(10000);
      bundle[table] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTenant.legal_name.replace(/\s+/g, '_')}_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-red-100 p-10 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('billing.grace_title')}</h1>
        <p className="text-gray-500 mb-6">{t('billing.grace_desc').replace('{n}', String(daysLeft))}</p>
        <div className="flex flex-col gap-3">
          <Link to="/app/settings" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors text-center">
            {t('billing.subscribe_now')}
          </Link>
          <button onClick={exportData} disabled={exporting} className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 text-gray-600 font-medium rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-50">
            <Download size={16} />
            {exporting ? t('common.loading') : t('billing.export_data')}
          </button>
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 mt-2">{t('nav.signout')}</button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionScreen() {
  const { t } = useI18n();
  const { activeTenant, signOut } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      setPlans(data ?? []);
      if (data?.[1]) setSelectedPlan(data[1].id);
    });
  }, []);

  const [err, setErr] = useState<string | null>(null);
  const handleSubscribe = async () => {
    if (!selectedPlan || !activeTenant) return;
    setLoading(true); setErr(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setErr(t('billing.error_no_session')); setLoading(false); return; }

    const result = await initiatePayment(import.meta.env.VITE_SUPABASE_URL, token, selectedPlan, billing);

    if (!result.ok) {
      setLoading(false);
      if (result.reason === 'no_gateway_configured') { setErr(t('billing.error_not_configured')); return; }
      if (result.reason === 'no_session') { setErr(t('billing.error_no_session')); return; }
      setErr(result.message || t('billing.error_generic'));
      return;
    }

    // Redirect to the chosen gateway's hosted checkout. Access is only
    // actually granted once that gateway's webhook confirms the payment
    // server-side and sets tenants.status/plan_id itself -- refreshing
    // here (after the user returns via redirect_url) just reflects
    // whatever the webhook has already done by then.
    window.location.href = result.payment_link;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <Logo variant="dark" />
          <h1 className="text-3xl font-bold text-white mt-6 mb-2">{t('billing.expired_title')}</h1>
          <p className="text-white/50">{t('billing.expired_desc')}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          {/* Billing toggle */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
              <button onClick={() => setBilling('monthly')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'}`}>
                {t('plan.monthly')}
              </button>
              <button onClick={() => setBilling('yearly')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'yearly' ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'}`}>
                {t('plan.yearly')} <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">-20%</span>
              </button>
            </div>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {plans.map((p) => (
              <button key={p.id} onClick={() => setSelectedPlan(p.id)}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${selectedPlan === p.id ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 hover:border-white/30 bg-white/5'}`}>
                <p className="text-white font-bold text-lg">{p.name}</p>
                <p className="text-blue-300 text-2xl font-bold mt-1">
                  ${billing === 'yearly' ? Math.round((p.price_yearly ?? p.price_monthly * 10) / 12) : p.price_monthly}
                  <span className="text-white/40 text-xs font-normal">/{t('plan.month')}</span>
                </p>
                {billing === 'yearly' && <p className="text-emerald-400 text-xs mt-1">{t('plan.save')} 2 {t('plan.months_free')}</p>}
                {selectedPlan === p.id && <div className="mt-3"><Check size={16} className="text-blue-300" /></div>}
              </button>
            ))}
          </div>

          {/* Payment provider */}
          <div className="mb-8">
            <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-blue-400 bg-blue-500/20">
              <CreditCard size={20} style={{ color: '#f5a623' }} />
              <div>
                <span className="text-sm text-white font-medium block">{t('billing.secure_payment')}</span>
                <span className="text-xs text-white/50">{t('billing.gateway_note')}</span>
              </div>
            </div>
          </div>

          {err && <p className="text-red-300 text-sm mb-4">{err}</p>}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleSubscribe} disabled={!selectedPlan || loading}
              className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Shield size={18} />}
              {t('billing.subscribe_cta')}
            </button>
            <button onClick={signOut} className="px-6 py-4 border border-white/20 text-white/60 rounded-2xl hover:bg-white/5 transition-colors text-sm">
              {t('nav.signout')}
            </button>
          </div>
          <CopyrightLine className="text-center text-white/30 text-xs mt-4" />
        </div>
      </div>
    </div>
  );
}
