import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Tenant, type SubscriptionPlan } from '../lib/supabase';
import { Button, Card, Input, Badge } from '../components/ui';
import { Settings as SettingsIcon, Building2, User, CreditCard, AlertTriangle, Check } from 'lucide-react';

export function SettingsPage() {
  const { t } = useI18n();
  const { activeTenant, user, profile, refresh } = useAuth();
  const [tab, setTab] = useState<'general' | 'profile' | 'billing'>('general');
  const [form, setForm] = useState({ legal_name: '', commercial_name: '', email: '', phone: '', website: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeTenant) {
      setForm({
        legal_name: activeTenant.legal_name ?? '',
        commercial_name: activeTenant.commercial_name ?? '',
        email: activeTenant.email ?? '',
        phone: activeTenant.phone ?? '',
        website: activeTenant.website ?? '',
        address: activeTenant.address ?? '',
      });
    }
  }, [activeTenant]);

  const save = async () => {
    if (!activeTenant) return;
    setSaving(true); setSaved(false);
    await supabase.from('tenants').update({
      legal_name: form.legal_name,
      commercial_name: form.commercial_name || null,
      email: form.email,
      phone: form.phone || null,
      website: form.website || null,
      address: form.address || null,
    }).eq('id', activeTenant.id);
    await refresh();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!activeTenant) return null;

  const tabs = [
    { key: 'general' as const, icon: Building2, label: t('settings.general') },
    { key: 'profile' as const, icon: User, label: t('settings.profile') },
    { key: 'billing' as const, icon: CreditCard, label: t('settings.billing') },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><SettingsIcon size={22} className="text-blue-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <tb.icon size={16} /> {tb.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Card className="p-6 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('settings.tenant_name')} required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            <Input label={t('onb.commercial')} value={form.commercial_name} onChange={(e) => setForm({ ...form, commercial_name: e.target.value })} />
            <Input label={t('settings.tenant_email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label={t('settings.tenant_phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t('settings.tenant_website')} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <Input label={t('settings.tenant_address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={save} loading={saving}>{t('settings.save')}</Button>
            {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={16} /> {t('settings.saved')}</span>}
          </div>
        </Card>
      )}

      {tab === 'profile' && (
        <Card className="p-6 max-w-2xl">
          <div className="space-y-4">
            <Input label={t('settings.profile_name')} value={profile?.full_name ?? ''} disabled />
            <Input label={t('settings.profile_email')} value={user?.email ?? ''} disabled />
          </div>
          <p className="mt-4 text-xs text-gray-400">Profile editing is managed via your account settings.</p>
        </Card>
      )}

      {tab === 'billing' && (
        <BillingTab tenant={activeTenant} onUpdated={refresh} />
      )}
    </div>
  );
}

function BillingTab({ tenant, onUpdated }: { tenant: Tenant; onUpdated: () => void }) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order');
      setPlans((data as SubscriptionPlan[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const selectPlan = async (planId: string) => {
    setSaving(true);
    await supabase.from('tenants').update({ plan_id: planId }).eq('id', tenant.id);
    await onUpdated();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const currentPlan = plans.find((p) => p.id === tenant.plan_id);

  return (
    <div className="space-y-6">
      <Card className="p-6 max-w-2xl">
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
          <div>
            <p className="text-sm text-gray-500">{t('settings.billing_plan')}</p>
            <p className="text-lg font-bold text-gray-900">{currentPlan?.name ?? t('settings.trial')}</p>
          </div>
          <Badge color={tenant.status === 'approved' ? 'green' : 'amber'}>{tenant.status}</Badge>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 mt-3">
          <div>
            <p className="text-sm text-gray-500">{t('dash.trial')}</p>
            <p className="text-lg font-bold text-gray-900">{new Date(tenant.trial_ends_at).toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('settings.choose_plan')}</h3>
        {loading ? <p className="text-sm text-gray-400">{t('common.loading')}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl">
            {plans.map((p) => {
              const isCurrent = p.id === tenant.plan_id;
              return (
                <Card key={p.id} className={`p-5 ${isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">${p.price_monthly}<span className="text-sm font-normal text-gray-400">/{t('plan.month')}</span></p>
                  {p.features && p.features.length > 0 && <ul className="mt-3 space-y-1">{p.features.slice(0, 4).map((f, i) => <li key={i} className="text-xs text-gray-500 flex items-start gap-1"><Check size={12} className="text-emerald-500 mt-0.5" /> {f}</li>)}</ul>}
                  <Button variant={isCurrent ? 'outline' : 'primary'} size="sm" className="w-full mt-4" disabled={isCurrent || saving} onClick={() => selectPlan(p.id)}>
                    {isCurrent ? t('settings.current_plan') : t('plan.choose')}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
        {saved && <p className="mt-3 text-sm text-emerald-600 flex items-center gap-1"><Check size={16} /> {t('settings.saved')}</p>}
      </div>
    </div>
  );
}
