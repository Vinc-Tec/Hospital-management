import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, ArrowRight, CreditCard, Smartphone, Building2, AlertCircle, Clock, Download } from 'lucide-react';
import { useAuth, isProtectedSuperAdminEmail } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/brand';
import { Card, Button } from '../components/ui';

type AccessState = 'loading' | 'ok' | 'grace' | 'expired';

const GRACE_DAYS_DEFAULT = 3;

const GATEWAYS = [
  { id: 'stripe', label: 'Stripe', icon: CreditCard, color: '#635bff' },
  { id: 'flutterwave', label: 'Flutterwave', icon: CreditCard, color: '#f5a623' },
  { id: 'paystack', label: 'Paystack', icon: CreditCard, color: '#00c3f7' },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone, color: '#ff7900' },
  { id: 'mtn_momo', label: 'MTN Mobile Money', icon: Smartphone, color: '#ffcc00' },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: '#64748b' },
];

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
  const { profile, user } = useAuth();
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user?.email)) return null;
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
  const { t } = useI18n();
  const { profile, user } = useAuth();

  // Super admins bypass all subscription requirements
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user?.email)) return <>{children}</>;

  if (state === 'loading') return null;
  if (state === 'ok') return <>{children}</>;
  if (state === 'grace') return <GracePeriodScreen daysLeft={graceDaysLeft} />;
  return <SubscriptionScreen />;
}

function GracePeriodScreen({ daysLeft }: { daysLeft: number }) {
  const { t } = useI18n();
  const { activeTenant, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-red-100 p-10 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">{t('billing.grace_title')}</h1>
        <p className="text-gray-500 mb-6">{t('billing.grace_desc').replace('{n}', String(daysLeft))}</p>
        <div className="flex flex-col gap-3">
          <Link to="/app/settings" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors text-center">
            {t('billing.subscribe_now')}
          </Link>
          <button className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 text-gray-600 font-medium rounded-2xl hover:bg-gray-50 transition-colors">
            <Download size={16} />
            {t('billing.export_data')}
          </button>
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 mt-2">{t('nav.signout')}</button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionScreen() {
  const { t } = useI18n();
  const { activeTenant, signOut, refresh } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      setPlans(data ?? []);
      if (data?.[1]) setSelectedPlan(data[1].id);
    });
  }, []);

  const handleSubscribe = async () => {
    if (!selectedPlan || !selectedGateway || !activeTenant) return;
    setLoading(true);
    await supabase.from('tenants').update({ plan_id: selectedPlan, status: 'approved' }).eq('id', activeTenant.id);
    await supabase.from('subscription_events').insert({
      tenant_id: activeTenant.id,
      event_type: 'subscription_created',
      metadata: { plan_id: selectedPlan, gateway: selectedGateway, billing_cycle: billing },
    }).then(() => {});
    await refresh();
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">{t('billing.success_title')}</h2>
          <p className="text-gray-500 mb-6">{t('billing.success_desc')}</p>
          <Link to="/app" className="block w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors">
            {t('onb.goto.dashboard')} <ArrowRight size={16} className="inline ml-1" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <Logo variant="dark" />
          <h1 className="text-3xl font-black text-white mt-6 mb-2">{t('billing.expired_title')}</h1>
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
                <p className="text-blue-300 text-2xl font-black mt-1">
                  ${billing === 'yearly' ? Math.round((p.price_yearly ?? p.price_monthly * 10) / 12) : p.price_monthly}
                  <span className="text-white/40 text-xs font-normal">/{t('plan.month')}</span>
                </p>
                {billing === 'yearly' && <p className="text-emerald-400 text-xs mt-1">{t('plan.save')} 2 {t('plan.months_free')}</p>}
                {selectedPlan === p.id && <div className="mt-3"><Check size={16} className="text-blue-300" /></div>}
              </button>
            ))}
          </div>

          {/* Payment gateways */}
          <div className="mb-8">
            <p className="text-white/60 text-sm font-semibold mb-3">{t('billing.choose_gateway')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {GATEWAYS.map((g) => (
                <button key={g.id} onClick={() => setSelectedGateway(g.id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${selectedGateway === g.id ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 hover:border-white/30 bg-white/5'}`}>
                  <g.icon size={20} style={{ color: g.color }} />
                  <span className="text-sm text-white font-medium">{g.label}</span>
                  {selectedGateway === g.id && <Check size={14} className="text-blue-300 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleSubscribe} disabled={!selectedPlan || !selectedGateway || loading}
              className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Shield size={18} />}
              {t('billing.subscribe_cta')}
            </button>
            <button onClick={signOut} className="px-6 py-4 border border-white/20 text-white/60 rounded-2xl hover:bg-white/5 transition-colors text-sm">
              {t('nav.signout')}
            </button>
          </div>
          <p className="text-center text-white/30 text-xs mt-4">Health Cloud&#8482; — Powered by LIYAH GROUP — &copy; 2026 All Rights Reserved.</p>
        </div>
      </div>
    </div>
  );
}
