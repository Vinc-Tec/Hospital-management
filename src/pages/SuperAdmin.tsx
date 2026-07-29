import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, CreditCard, Globe, ScrollText, ShieldCheck,
  Check, X, AlertCircle, Eye, Ban, MessageSquarePlus, Users, TrendingUp,
  DollarSign, Ticket, UserPlus, Activity, Server, Bell, Settings as SettingsIcon,
  FileBarChart, Wallet, HeadphonesIcon, Key, MapPin, Map,
  Trash2, Search, Menu,
} from 'lucide-react';
import { useAuth, isProtectedSuperAdminEmail } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Tenant, type SubscriptionPlan, type AuditLog } from '../lib/supabase';
import { Button, Card, Input, Modal, Badge, EmptyState } from '../components/ui';
import { Logo, LangToggle, StatusBadge, CopyrightLine } from '../components/brand';

const SUPER_ADMIN_EMAILS = ['vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com', 'liyahjoha@gmail.com'];
const PROTECTED_EMAILS = SUPER_ADMIN_EMAILS;

const NAV = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'tenants', icon: Building2 },
  { key: 'subscriptions', icon: CreditCard },
  { key: 'revenue', icon: Wallet },
  { key: 'performance', icon: TrendingUp },
  { key: 'geography', icon: Globe },
  { key: 'cities', icon: Map },
  { key: 'localities', icon: MapPin },
  { key: 'marketplace', icon: Ticket },
  { key: 'payments', icon: CreditCard },
  { key: 'support', icon: HeadphonesIcon },
  { key: 'api', icon: Key },
  { key: 'audit', icon: ScrollText },
  { key: 'users', icon: Users },
  { key: 'roles', icon: ShieldCheck },
  { key: 'billing', icon: DollarSign },
  { key: 'reports', icon: FileBarChart },
  { key: 'analytics', icon: Activity },
  { key: 'notifications', icon: Bell },
  { key: 'settings', icon: SettingsIcon },
];

export function SuperAdmin() {
  const { t } = useI18n();
  const { profile, user } = useAuth();
  const loc = useLocation();
  const [section, setSection] = useState(loc.hash.replace('#', '') || 'overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string; region_id: string }[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [localities, setLocalities] = useState<any[]>([]);
  const [commercialCodes, setCommercialCodes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loginActivity, setLoginActivity] = useState<any[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, suspended: 0, mrr: 0, totalRevenue: 0 });

  const loadAll = async () => {
    const [{ data: tns }, { data: pl }, { data: lg }, { data: cs }, { data: dst }, { data: cts }, { data: lcs }, { data: cc }, { data: pr }, { data: la }, { data: bi }, { data: st }, { data: ak }, { data: nt }] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('countries').select('id, name').order('name'),
      supabase.from('districts').select('id, name, region_id').order('name'),
      supabase.from('cities').select('id, name, district_id').order('name'),
      supabase.from('localities').select('id, name, city_id').order('name'),
      supabase.from('commercial_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email, is_super_admin').order('full_name'),
      supabase.from('login_activity').select('*').order('login_at', { ascending: false }).limit(200),
      supabase.from('billing_invoices').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('api_keys').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_notifications').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const tList = (tns as Tenant[]) ?? [];
    setTenants(tList);
    setPlans((pl as SubscriptionPlan[]) ?? []);
    setLogs((lg as AuditLog[]) ?? []);
    setCountries((cs as { id: string; name: string }[]) ?? []);
    setDistricts((dst as { id: string; name: string; region_id: string }[]) ?? []);
    setCities(cts ?? []);
    setLocalities(lcs ?? []);
    setCommercialCodes(cc ?? []);
    setProfiles(pr ?? []);
    setLoginActivity(la ?? []);
    setBillingInvoices(bi ?? []);
    setSupportTickets(st ?? []);
    setApiKeys(ak ?? []);
    setNotifications(nt ?? []);
    const activeTenants = tList.filter((x) => x.status === 'approved');
    setStats({
      total: tList.length,
      active: activeTenants.length,
      pending: tList.filter((x) => x.status === 'pending').length,
      suspended: tList.filter((x) => x.status === 'suspended').length,
      mrr: activeTenants.reduce((s, x) => {
        const plan = (pl as SubscriptionPlan[])?.find((p) => p.id === x.plan_id);
        return s + (plan?.price_monthly ?? 0);
      }, 0),
      totalRevenue: activeTenants.reduce((s, x) => {
        const plan = (pl as SubscriptionPlan[])?.find((p) => p.id === x.plan_id);
        return s + (plan?.price_yearly ?? (plan?.price_monthly ?? 0) * 12);
      }, 0),
    });
  };
  useEffect(() => { loadAll(); }, []);

  const isAuthorized = profile?.is_super_admin && user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-red-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('sa.no_access')}</h2>
          <p className="text-sm text-gray-500 mb-6">{t('sa.no_access_desc')}</p>
          <Link to="/app"><Button>{t('onb.goto.dashboard')}</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`w-64 bg-gray-900 text-gray-300 flex flex-col fixed lg:sticky top-0 h-screen z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center px-5 border-b border-gray-800 flex-shrink-0"><Logo size={30} /></div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => { setSection(n.key); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${section === n.key ? 'bg-emerald-600/20 text-emerald-400 font-medium' : 'hover:bg-gray-800'}`}>
              <n.icon size={18} /> <span className="capitalize">{n.key.replace(/_/g, ' ')}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800 flex-shrink-0">
          <Link to="/app" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800"><ShieldCheck size={18} /> {t('nav.dashboard')}</Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 bg-gray-50 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"><Menu size={20} /></button>
            <h1 className="font-semibold text-gray-900">{t('sa.title')}</h1>
            <span className="hidden sm:inline text-xs text-gray-400">{user?.email}</span>
          </div>
          <LangToggle />
        </header>
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {section === 'overview' && <SaOverview stats={stats} tenants={tenants} loginActivity={loginActivity} />}
          {section === 'tenants' && <SaTenants tenants={tenants} onAction={loadAll} />}
          {section === 'subscriptions' && <SaSubscriptions tenants={tenants} plans={plans} onAction={loadAll} />}
          {section === 'revenue' && <SaRevenue tenants={tenants} plans={plans} billingInvoices={billingInvoices} />}
          {section === 'performance' && <SaPerformance tenants={tenants} />}
          {section === 'geography' && <SaGeography countries={countries} regions={regions} setRegions={setRegions} districts={districts} setDistricts={setDistricts} onAction={loadAll} />}
          {section === 'cities' && <SaCities regions={regions} districts={districts} cities={cities} onAction={loadAll} />}
          {section === 'localities' && <SaLocalities countries={countries} regions={regions} cities={cities} localities={localities} onAction={loadAll} />}
          {section === 'marketplace' && <SaMarketplace codes={commercialCodes} onAction={loadAll} />}
          {section === 'payments' && <SaPayments billingInvoices={billingInvoices} tenants={tenants} />}
          {section === 'support' && <SaSupport tickets={supportTickets} onAction={loadAll} />}
          {section === 'api' && <SaApi apiKeys={apiKeys} onAction={loadAll} />}
          {section === 'audit' && <SaAudit logs={logs} />}
          {section === 'users' && <SaUsers profiles={profiles} tenants={tenants} onAction={loadAll} />}
          {section === 'roles' && <SaRoles profiles={profiles} />}
          {section === 'billing' && <SaBilling tenants={tenants} plans={plans} billingInvoices={billingInvoices} />}
          {section === 'reports' && <SaReports tenants={tenants} plans={plans} logs={logs} />}
          {section === 'analytics' && <SaAnalytics tenants={tenants} loginActivity={loginActivity} />}
          {section === 'notifications' && <SaNotifications notifications={notifications} onAction={loadAll} />}
          {section === 'settings' && <SaSystemSettings />}
        </main>
        <footer className="bg-gray-900 text-gray-400 py-4 flex-shrink-0">
          <div className="text-center px-4">
            <CopyrightLine className="text-sm font-medium text-gray-300" />
          </div>
        </footer>
      </div>
    </div>
  );
}

function SaOverview({ stats, tenants, loginActivity }: { stats: { total: number; active: number; pending: number; suspended: number; mrr: number; totalRevenue: number }; tenants: Tenant[]; loginActivity: any[] }) {
  const { t } = useI18n();
  const kpis = [
    { label: t('sa.active_tenants'), value: stats.active, color: 'emerald' },
    { label: t('sa.pending'), value: stats.pending, color: 'amber' },
    { label: t('sa.mrr'), value: `$${stats.mrr}`, color: 'blue' },
    { label: t('sa.total_revenue'), value: `$${stats.totalRevenue}`, color: 'gray' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <Card key={i} className="p-5"><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${k.color}-50`}><Building2 size={20} className={`text-${k.color}-600`} /></div><p className="text-2xl font-bold text-gray-900">{k.value}</p><p className="text-sm text-gray-500">{k.label}</p></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t('sa.recent_tenants')}</h3>
          {tenants.length === 0 ? <EmptyState icon={Building2} title={t('common.none')} /> : (
            <div className="space-y-2">{tenants.slice(0, 10).map((tn) => <div key={tn.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div><p className="text-sm font-medium text-gray-900">{tn.commercial_name || tn.legal_name}</p><p className="text-xs text-gray-400">{tn.email}</p></div><StatusBadge status={tn.status} /></div>)}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t('sa.recent_logins')}</h3>
          {loginActivity.length === 0 ? <EmptyState icon={Activity} title={t('common.none')} /> : (
            <div className="space-y-2">{loginActivity.slice(0, 10).map((la) => <div key={la.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div><p className="text-sm font-medium text-gray-900">{la.device} · {la.browser}</p><p className="text-xs text-gray-400">{new Date(la.login_at).toLocaleString()}</p></div><Badge color={la.success ? 'green' : 'red'}>{la.success ? 'Success' : 'Failed'}</Badge></div>)}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SaTenants({ tenants, onAction }: { tenants: Tenant[]; onAction: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [note, setNote] = useState('');

  const setStatus = async (tn: Tenant, status: Tenant['status']) => {
    await supabase.from('tenants').update({ status, verification_note: note || null }).eq('id', tn.id);
    await supabase.from('audit_logs').insert({ tenant_id: tn.id, actor_user_id: user?.id, action: `tenant.${status}`, entity_type: 'tenants', entity_id: tn.id, details: { note } });
    setSelected(null); setNote(''); onAction();
  };

  return (
    <Card className="overflow-hidden">
      {tenants.length === 0 ? <div className="p-8"><EmptyState icon={Building2} title={t('common.none')} /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">{['Name', 'Type', 'Email', 'Status', 'Trial end', t('common.actions')].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.map((tn) => (
                <tr key={tn.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{tn.commercial_name || tn.legal_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tn.healthcare_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tn.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={tn.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(tn.trial_ends_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => { setSelected(tn); setNote(tn.verification_note ?? ''); }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title={t('sa.verify')}><Eye size={16} /></button>
                    <button onClick={() => setStatus(tn, 'approved')} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title={t('sa.approve')}><Check size={16} /></button>
                    <button onClick={() => setStatus(tn, 'rejected')} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title={t('sa.reject')}><X size={16} /></button>
                    <button onClick={() => setStatus(tn, 'suspended')} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title={t('sa.suspend')}><Ban size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('sa.tenant_detail')} footer={<><Button variant="outline" onClick={() => setSelected(null)}>{t('common.cancel')}</Button><Button onClick={() => selected && setStatus(selected, selected.status)}>{t('sa.save_note')}</Button></>}>
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-gray-400">Legal:</span> {selected.legal_name}</div><div><span className="text-gray-400">Type:</span> {selected.healthcare_type}</div><div><span className="text-gray-400">Email:</span> {selected.email}</div><div><span className="text-gray-400">Phone:</span> {selected.phone || '—'}</div></div>
            <Input label={t('sa.verification_note')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setStatus(selected, 'approved')}><Check size={14} /> {t('sa.approve')}</Button>
              <Button variant="danger" size="sm" onClick={() => setStatus(selected, 'rejected')}><X size={14} /> {t('sa.reject')}</Button>
              <Button variant="outline" size="sm" onClick={() => setStatus(selected, 'request_info')}><MessageSquarePlus size={14} /> {t('sa.request_info')}</Button>
              <Button variant="outline" size="sm" onClick={() => setStatus(selected, 'suspended')}><Ban size={14} /> {t('sa.suspend')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function SaSubscriptions({ tenants, plans, onAction }: { tenants: Tenant[]; plans: SubscriptionPlan[]; onAction: () => void }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [planId, setPlanId] = useState('');

  const assignPlan = async () => {
    if (!selected) return;
    await supabase.from('tenants').update({ plan_id: planId || null }).eq('id', selected.id);
    setSelected(null); onAction();
  };

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('sa.institution')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.plan')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.map((tn) => (
                <tr key={tn.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{tn.commercial_name || tn.legal_name}</td>
                  <td className="px-4 py-3"><Badge color={tn.plan_id ? 'blue' : 'gray'}>{planName(tn.plan_id)}</Badge></td>
                  <td className="px-4 py-3"><StatusBadge status={tn.status} /></td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => { setSelected(tn); setPlanId(tn.plan_id ?? ''); }}>{t('sa.assign_plan')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('sa.assign_plan')} footer={<><Button variant="outline" onClick={() => setSelected(null)}>{t('common.cancel')}</Button><Button onClick={assignPlan}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{selected?.commercial_name || selected?.legal_name}</p>
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('sa.nav.plans')}</span><select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm"><option value="">—</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo</option>)}</select></label>
        </div>
      </Modal>
    </div>
  );
}

function SaRevenue({ tenants, plans, billingInvoices }: { tenants: Tenant[]; plans: SubscriptionPlan[]; billingInvoices: any[] }) {
  const { t } = useI18n();
  const active = tenants.filter((tn) => tn.status === 'approved');
  const totalMrr = active.reduce((s, tn) => {
    const plan = plans.find((p) => p.id === tn.plan_id);
    return s + (plan?.price_monthly ?? 0);
  }, 0);
  const totalArr = totalMrr * 12;
  const collected = billingInvoices.filter((bi) => bi.status === 'paid').reduce((s, bi) => s + Number(bi.amount_paid ?? 0), 0);
  const outstanding = billingInvoices.filter((bi) => bi.status !== 'paid' && bi.status !== 'void').reduce((s, bi) => s + Number(bi.amount_due ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50"><DollarSign size={20} className="text-blue-600" /></div><p className="text-2xl font-bold text-gray-900">${totalMrr}</p><p className="text-sm text-gray-500">{t('sa.mrr')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-emerald-50"><TrendingUp size={20} className="text-emerald-600" /></div><p className="text-2xl font-bold text-gray-900">${totalArr}</p><p className="text-sm text-gray-500">{t('sa.arr')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-emerald-50"><Wallet size={20} className="text-emerald-600" /></div><p className="text-2xl font-bold text-gray-900">${collected}</p><p className="text-sm text-gray-500">{t('sa.collected')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-red-50"><AlertCircle size={20} className="text-red-600" /></div><p className="text-2xl font-bold text-gray-900">${outstanding}</p><p className="text-sm text-gray-500">{t('sa.outstanding')}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('sa.institution')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.plan')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.monthly')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.yearly')}</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {active.map((tn) => {
                const plan = plans.find((p) => p.id === tn.plan_id);
                return (
                  <tr key={tn.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{tn.commercial_name || tn.legal_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{plan?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">${plan?.price_monthly ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">${plan?.price_yearly ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SaPerformance({ tenants }: { tenants: Tenant[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const results: any[] = [];
      for (const tn of tenants.filter((t) => t.status === 'approved')) {
        const { data } = await supabase.rpc('staff_performance', { p_tenant: tn.id });
        if (data) results.push({ tenant: tn.commercial_name || tn.legal_name, rows: data });
      }
      setData(results); setLoading(false);
    })();
  }, [tenants]);
  if (loading) return <Card className="p-8"><div className="text-center text-sm text-gray-400">Loading...</div></Card>;
  if (data.length === 0) return <Card className="p-8"><EmptyState icon={TrendingUp} title="No performance data" /></Card>;
  return (
    <div className="space-y-6">
      {data.map((d) => (
        <Card key={d.tenant} className="overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-900">{d.tenant}</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50">{['Doctor', 'Appointments', 'Revenue', 'Rating'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {d.rows.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.doctor_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.appointment_count ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">${r.revenue ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.avg_rating ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SaGeography({ countries, regions, setRegions, districts, setDistricts, onAction }: { countries: { id: string; name: string }[]; regions: { id: string; name: string }[]; setRegions: (r: { id: string; name: string }[]) => void; districts: { id: string; name: string; region_id: string }[]; setDistricts: (d: { id: string; name: string; region_id: string }[]) => void; onAction: () => void }) {
  const { t } = useI18n();
  const [cForm, setCForm] = useState({ name: '', iso2: '', phone_code: '', currency_code: '' });
  const [rForm, setRForm] = useState({ country_id: '', name: '' });
  const [dForm, setDForm] = useState({ region_id: '', name: '' });
  const addCountry = async () => {
    await supabase.from('countries').insert({ name: cForm.name, iso2: cForm.iso2.toUpperCase(), phone_code: cForm.phone_code || null, currency_code: cForm.currency_code || null });
    setCForm({ name: '', iso2: '', phone_code: '', currency_code: '' }); onAction();
  };
  const addRegion = async () => {
    await supabase.from('regions').insert({ country_id: rForm.country_id, name: rForm.name });
    setRForm({ country_id: '', name: '' });
    const { data: regData } = await supabase.from('regions').select('id, name').eq('country_id', rForm.country_id).order('name');
    setRegions((regData as { id: string; name: string }[]) ?? []);
  };
  const addDistrict = async () => {
    await supabase.from('districts').insert({ region_id: dForm.region_id, name: dForm.name });
    setDForm({ region_id: '', name: '' });
    const { data: distData } = await supabase.from('districts').select('id, name, region_id').order('name');
    setDistricts((distData as { id: string; name: string; region_id: string }[]) ?? []);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.add_country')}</h3>
        <div className="space-y-3">
          <Input label={t('common.name')} value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input label={t('sa.iso2')} value={cForm.iso2} onChange={(e) => setCForm({ ...cForm, iso2: e.target.value })} />
            <Input label={t('sa.phone_code')} value={cForm.phone_code} onChange={(e) => setCForm({ ...cForm, phone_code: e.target.value })} />
            <Input label={t('sa.currency')} value={cForm.currency_code} onChange={(e) => setCForm({ ...cForm, currency_code: e.target.value })} />
          </div>
          <Button onClick={addCountry} className="w-full">{t('common.save')}</Button>
        </div>
        <div className="mt-4 max-h-48 overflow-y-auto space-y-1">{countries.map((c) => <div key={c.id} className="text-sm text-gray-600 py-1 border-b border-gray-50">{c.name}</div>)}</div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.add_region')}</h3>
        <div className="space-y-3">
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('onb.country')}</span><select value={rForm.country_id} onChange={(e) => setRForm({ country_id: e.target.value, name: rForm.name })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm"><option value="">...</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Input label={t('common.name')} value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
          <Button onClick={addRegion} className="w-full" disabled={!rForm.country_id}>{t('common.save')}</Button>
        </div>
        <div className="mt-4 max-h-48 overflow-y-auto space-y-1">{regions.map((r) => <div key={r.id} className="text-sm text-gray-600 py-1 border-b border-gray-50">{r.name}</div>)}</div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.add_district')}</h3>
        <div className="space-y-3">
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('sa.region_single')}</span><select value={dForm.region_id} onChange={(e) => setDForm({ ...dForm, region_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm"><option value="">...</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <Input label={t('common.name')} value={dForm.name} onChange={(e) => setDForm({ ...dForm, name: e.target.value })} />
          <Button onClick={addDistrict} className="w-full" disabled={!dForm.region_id}>{t('common.save')}</Button>
        </div>
        <div className="mt-4 max-h-48 overflow-y-auto space-y-1">{districts.map((d) => <div key={d.id} className="text-sm text-gray-600 py-1 border-b border-gray-50">{d.name}</div>)}</div>
      </Card>
    </div>
  );
}

function SaCities({ regions, districts, cities, onAction }: { regions: { id: string; name: string }[]; districts: { id: string; name: string; region_id: string }[]; cities: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ region_id: '', district_id: '', name: '' });
  const filteredDistricts = districts.filter((d) => d.region_id === form.region_id);
  const addCity = async () => {
    await supabase.from('cities').insert({ district_id: form.district_id, name: form.name });
    setForm({ region_id: '', district_id: '', name: '' }); onAction();
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.add_city')}</h3>
        <div className="space-y-3">
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('sa.region_single')}</span>
            <select value={form.region_id} onChange={(e) => setForm({ region_id: e.target.value, district_id: '', name: form.name })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm">
              <option value="">...</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('onb.district')}</span>
            <select value={form.district_id} onChange={(e) => setForm({ ...form, district_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm" disabled={!form.region_id}>
              <option value="">...</option>
              {filteredDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Button onClick={addCity} className="w-full" disabled={!form.district_id}>{t('common.save')}</Button>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.cities_count').replace('{n}', String(cities.length))}</h3>
        <div className="max-h-96 overflow-y-auto space-y-1">{cities.map((c) => <div key={c.id} className="text-sm text-gray-600 py-1 border-b border-gray-50">{c.name}</div>)}</div>
      </Card>
    </div>
  );
}

function SaLocalities({ countries, regions, cities, localities, onAction }: { countries: { id: string; name: string }[]; regions: { id: string; name: string }[]; cities: any[]; localities: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ city_id: '', name: '' });
  const addLocality = async () => {
    await supabase.from('localities').insert({ city_id: form.city_id, name: form.name });
    setForm({ city_id: '', name: '' }); onAction();
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.add_locality')}</h3>
        <div className="space-y-3">
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">City</span>
            <select value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm">
              <option value="">...</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Button onClick={addLocality} className="w-full" disabled={!form.city_id}>{t('common.save')}</Button>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Localities ({localities.length})</h3>
        <div className="max-h-96 overflow-y-auto space-y-1">{localities.map((l) => <div key={l.id} className="text-sm text-gray-600 py-1 border-b border-gray-50">{l.name}</div>)}</div>
      </Card>
    </div>
  );
}

function SaMarketplace({ codes, onAction }: { codes: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ country_iso: '', description: '', discount_percent: '10', max_uses: '', valid_until: '' });

  const generateCode = async (iso: string) => {
    const prefix = `HC-${iso.toUpperCase().slice(0, 3)}`;
    const { count } = await supabase.from('commercial_codes').select('*', { count: 'exact', head: true }).like('code', `${prefix}-%`);
    const seq = String((count ?? 0) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  };

  const save = async () => {
    if (!form.country_iso) return;
    const code = await generateCode(form.country_iso);
    await supabase.from('commercial_codes').insert({
      code, description: form.description || null, discount_percent: parseFloat(form.discount_percent) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null, valid_until: form.valid_until || null, created_by: user?.id,
    });
    setForm({ country_iso: '', description: '', discount_percent: '10', max_uses: '', valid_until: '' }); setOpen(false); onAction();
  };

  const toggle = async (c: any) => { await supabase.from('commercial_codes').update({ is_active: !c.is_active }).eq('id', c.id); onAction(); };

  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><Ticket size={16} /> {t('sa.add_code')}</Button></div>
      <Card className="overflow-hidden">
        {codes.length === 0 ? <div className="p-8"><EmptyState icon={Ticket} title={t('common.none')} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('sa.code')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('sa.discount')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('sa.uses')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{c.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.discount_percent}%</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                    <td className="px-4 py-3"><Badge color={c.is_active ? 'green' : 'gray'}>{c.is_active ? t('opt.active') : t('opt.inactive')}</Badge></td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => toggle(c)}>{c.is_active ? t('sa.deactivate') : t('sa.activate')}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={t('sa.add_code')} footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <Input label="Country ISO (e.g. CMR)" required placeholder="CMR, CIV, SEN..." value={form.country_iso} onChange={(e) => setForm({ ...form, country_iso: e.target.value })} />
          <Input label={t('fld.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Discount %" type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
          <Input label="Max uses" type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
          <Input label="Valid until" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function SaPayments({ billingInvoices, tenants }: { billingInvoices: any[]; tenants: Tenant[] }) {
  const { t } = useI18n();
  const tenantName = (id: string) => tenants.find((tn) => tn.id === id)?.commercial_name ?? '—';
  if (billingInvoices.length === 0) return <Card className="p-8"><EmptyState icon={CreditCard} title={t('common.none')} /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-100">{[t('common.invoice_no'), t('sa.institution'), t('common.amount'), t('common.paid'), t('common.status'), t('common.due_date')].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {billingInvoices.map((bi) => (
              <tr key={bi.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-mono text-gray-900">{bi.invoice_number || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{tenantName(bi.tenant_id)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">${bi.amount_due ?? 0}</td>
                <td className="px-4 py-3 text-sm text-gray-600">${bi.amount_paid ?? 0}</td>
                <td className="px-4 py-3"><Badge color={bi.status === 'paid' ? 'green' : bi.status === 'open' ? 'blue' : 'gray'}>{bi.status}</Badge></td>
                <td className="px-4 py-3 text-sm text-gray-600">{bi.due_date ? new Date(bi.due_date).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SaSupport({ tickets, onAction }: { tickets: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<any | null>(null);
  const [reply, setReply] = useState('');

  const respond = async () => {
    if (!selected) return;
    await supabase.from('support_tickets').update({ status: 'resolved', resolution: reply }).eq('id', selected.id);
    setSelected(null); setReply(''); onAction();
  };

  if (tickets.length === 0) return <Card className="p-8"><EmptyState icon={HeadphonesIcon} title={t('common.none')} /></Card>;
  return (
    <div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">{['Subject', 'Priority', 'Status', 'Created', t('common.actions')].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map((tk) => (
                <tr key={tk.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{tk.subject || '—'}</td>
                  <td className="px-4 py-3"><Badge color={tk.priority === 'high' ? 'red' : tk.priority === 'medium' ? 'amber' : 'gray'}>{tk.priority || 'low'}</Badge></td>
                  <td className="px-4 py-3"><Badge color={tk.status === 'open' ? 'blue' : tk.status === 'resolved' ? 'green' : 'gray'}>{tk.status}</Badge></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(tk.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => setSelected(tk)}>{t('sa.respond')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('sa.respond_to_ticket')} footer={<><Button variant="outline" onClick={() => setSelected(null)}>{t('common.cancel')}</Button><Button onClick={respond}>{t('sa.resolve')}</Button></>}>
        {selected && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{selected.subject}</p>
            <p className="text-sm text-gray-600">{selected.description}</p>
            <Input label="Resolution" value={reply} onChange={(e) => setReply(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function SaApi({ apiKeys, onAction }: { apiKeys: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', scopes: 'read' });

  const createKey = async () => {
    const keyValue = `hck_${crypto.randomUUID().replace(/-/g, '')}`;
    await supabase.from('api_keys').insert({ name: form.name, key_hash: btoa(keyValue).slice(0, 64), scopes: form.scopes.split(','), is_active: true });
    setForm({ name: '', scopes: 'read' }); setOpen(false); onAction();
  };

  const toggle = async (k: any) => { await supabase.from('api_keys').update({ is_active: !k.is_active }).eq('id', k.id); onAction(); };

  return (
    <div>
      <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
        ⚠️ Health Cloud does not yet expose a public API for external integrations. Keys generated here are stored but not currently validated against any endpoint -- this section is provisioned for a future public API and has no effect yet.
      </div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><Key size={16} /> Generate API Key</Button></div>
      <Card className="overflow-hidden">
        {apiKeys.length === 0 ? <div className="p-8"><EmptyState icon={Key} title={t('common.none')} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-100">{['Name', 'Scopes', 'Status', t('common.actions')].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{k.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{Array.isArray(k.scopes) ? k.scopes.join(', ') : k.scopes}</td>
                    <td className="px-4 py-3"><Badge color={k.is_active ? 'green' : 'gray'}>{k.is_active ? t('opt.active') : t('opt.inactive')}</Badge></td>
                    <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => toggle(k)}>{k.is_active ? t('sa.deactivate') : t('sa.activate')}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Generate API Key" footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={createKey}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <Input label="Key Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Scopes (comma-separated)" value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function SaAudit({ logs }: { logs: AuditLog[] }) {
  const { t } = useI18n();
  if (logs.length === 0) return <Card className="p-8"><EmptyState icon={ScrollText} title={t('common.none')} /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-100">{[t('common.date'), t('sa.action'), t('sa.actor'), t('sa.details')].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-4 py-3"><Badge color="blue">{l.action}</Badge></td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">{l.actor_user_id?.slice(0, 8) ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SaUsers({ profiles, tenants, onAction }: { profiles: any[]; tenants: Tenant[]; onAction: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', is_super_admin: false });

  const createStaff = async () => {
    const { data: authData, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.full_name } } });
    if (!error && authData.user) {
      await supabase.from('profiles').update({ full_name: form.full_name, is_super_admin: form.is_super_admin, email: form.email }).eq('id', authData.user.id);
    }
    setForm({ full_name: '', email: '', password: '', is_super_admin: false }); setOpen(false); onAction();
  };

  const toggleSuperAdmin = async (p: any) => {
    const isProtected = PROTECTED_EMAILS.includes((p.email ?? '').toLowerCase());
    if (isProtected) return;
    await supabase.from('profiles').update({ is_super_admin: !p.is_super_admin }).eq('id', p.id);
    onAction();
  };

  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><UserPlus size={16} /> {t('sa.add_staff')}</Button></div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.name')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.email')}</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('sa.super_admin_label')}</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map((p) => {
                const isProtected = PROTECTED_EMAILS.includes((p.email ?? '').toLowerCase());
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.email || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge color={p.is_super_admin ? 'green' : 'gray'}>{p.is_super_admin ? 'Yes' : 'No'}</Badge>
                        {isProtected && <Badge color="blue">{t('sa.protected')}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isProtected && (
                        <Button size="sm" variant="outline" onClick={() => toggleSuperAdmin(p)}>{p.is_super_admin ? 'Remove' : 'Grant'} Admin</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={t('sa.add_staff')} footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={createStaff}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <Input label={t('common.name')} required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input label={t('col.email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('auth.password')} type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_super_admin} onChange={(e) => setForm({ ...form, is_super_admin: e.target.checked })} className="accent-blue-600" /> <span className="text-sm text-gray-700">{t('sa.super_admin_label')}</span></label>
        </div>
      </Modal>
    </div>
  );
}

function SaRoles({ profiles }: { profiles: any[] }) {
  const { t } = useI18n();
  const roles = ['super_admin', 'tenant_admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'accountant'];
  const counts: Record<string, number> = {};
  profiles.forEach((p) => { const r = p.is_super_admin ? 'super_admin' : 'tenant_admin'; counts[r] = (counts[r] ?? 0) + 1; });
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {roles.map((r) => (
        <Card key={r} className="p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50"><ShieldCheck size={20} className="text-blue-600" /></div>
          <p className="text-2xl font-bold text-gray-900">{counts[r] ?? 0}</p>
          <p className="text-sm text-gray-500 capitalize">{r.replace(/_/g, ' ')}</p>
        </Card>
      ))}
    </div>
  );
}

function SaBilling({ tenants, plans, billingInvoices }: { tenants: Tenant[]; plans: SubscriptionPlan[]; billingInvoices: any[] }) {
  const { t } = useI18n();
  const totalCollected = billingInvoices.filter((bi) => bi.status === 'paid').reduce((s, bi) => s + Number(bi.amount_paid ?? 0), 0);
  const totalOutstanding = billingInvoices.filter((bi) => bi.status !== 'paid' && bi.status !== 'void').reduce((s, bi) => s + Number(bi.amount_due ?? 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-emerald-50"><DollarSign size={20} className="text-emerald-600" /></div><p className="text-2xl font-bold text-gray-900">${totalCollected}</p><p className="text-sm text-gray-500">{t('sa.total_collected')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-red-50"><AlertCircle size={20} className="text-red-600" /></div><p className="text-2xl font-bold text-gray-900">${totalOutstanding}</p><p className="text-sm text-gray-500">{t('sa.outstanding')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50"><Building2 size={20} className="text-blue-600" /></div><p className="text-2xl font-bold text-gray-900">{billingInvoices.length}</p><p className="text-sm text-gray-500">{t('sa.total_invoices')}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">{[t('common.invoice_no'), t('sa.institution'), t('common.amount'), t('common.status'), t('common.due_date')].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {billingInvoices.map((bi) => {
                const tn = tenants.find((t) => t.id === bi.tenant_id);
                return (
                  <tr key={bi.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{bi.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tn?.commercial_name || tn?.legal_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">${bi.amount_due ?? 0}</td>
                    <td className="px-4 py-3"><Badge color={bi.status === 'paid' ? 'green' : 'blue'}>{bi.status}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{bi.due_date ? new Date(bi.due_date).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SaReports({ tenants, plans, logs }: { tenants: Tenant[]; plans: SubscriptionPlan[]; logs: AuditLog[] }) {
  const { t } = useI18n();
  const byStatus = { pending: 0, approved: 0, suspended: 0, rejected: 0 };
  tenants.forEach((tn) => { (byStatus as any)[tn.status] = ((byStatus as any)[tn.status] ?? 0) + 1; });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(byStatus).map(([k, v]) => (
          <Card key={k} className="p-5"><p className="text-2xl font-bold text-gray-900">{v}</p><p className="text-sm text-gray-500 capitalize">{k}</p></Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.plan_distribution')}</h3>
        <div className="space-y-2">
          {plans.map((p) => {
            const count = tenants.filter((tn) => tn.plan_id === p.id).length;
            return <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm font-medium text-gray-900">{p.name}</span><Badge color="blue">{count} institutions</Badge></div>;
          })}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Audit Activity ({logs.length})</h3>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {logs.slice(0, 20).map((l) => <div key={l.id} className="text-sm text-gray-600 py-1 border-b border-gray-50"><span className="font-mono text-xs text-gray-400">{new Date(l.created_at).toLocaleString()}</span> — <Badge color="blue">{l.action}</Badge></div>)}
        </div>
      </Card>
    </div>
  );
}

function SaAnalytics({ tenants, loginActivity }: { tenants: Tenant[]; loginActivity: any[] }) {
  const successful = loginActivity.filter((la) => la.success).length;
  const failed = loginActivity.filter((la) => !la.success).length;
  const byDevice: Record<string, number> = {};
  loginActivity.forEach((la) => { byDevice[la.device] = (byDevice[la.device] ?? 0) + 1; });
  const byBrowser: Record<string, number> = {};
  loginActivity.forEach((la) => { byBrowser[la.browser] = (byBrowser[la.browser] ?? 0) + 1; });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-emerald-50"><Activity size={20} className="text-emerald-600" /></div><p className="text-2xl font-bold text-gray-900">{loginActivity.length}</p><p className="text-sm text-gray-500">{t('sa.total_logins')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50"><Check size={20} className="text-blue-600" /></div><p className="text-2xl font-bold text-gray-900">{successful}</p><p className="text-sm text-gray-500">{t('sa.successful')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-red-50"><X size={20} className="text-red-600" /></div><p className="text-2xl font-bold text-gray-900">{failed}</p><p className="text-sm text-gray-500">{t('sa.failed')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-amber-50"><Building2 size={20} className="text-amber-600" /></div><p className="text-2xl font-bold text-gray-900">{tenants.length}</p><p className="text-sm text-gray-500">{t('sa.institutions_label')}</p></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t('sa.by_device')}</h3>
          <div className="space-y-2">{Object.entries(byDevice).map(([k, v]) => <div key={k} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-600">{k}</span><Badge color="gray">{v}</Badge></div>)}</div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t('sa.by_browser')}</h3>
          <div className="space-y-2">{Object.entries(byBrowser).map(([k, v]) => <div key={k} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-600">{k}</span><Badge color="gray">{v}</Badge></div>)}</div>
        </Card>
      </div>
    </div>
  );
}


function SaNotifications({ notifications, onAction }: { notifications: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', target: 'all' });

  const send = async () => {
    await supabase.from('platform_notifications').insert({ title: form.title, message: form.message, target: form.target });
    setForm({ title: '', message: '', target: 'all' }); setOpen(false); onAction();
  };

  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><Bell size={16} /> Send Notification</Button></div>
      <Card className="overflow-hidden">
        {notifications.length === 0 ? <div className="p-8"><EmptyState icon={Bell} title={t('common.none')} /></div> : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div key={n.id} className="p-4 hover:bg-gray-50/50">
                <div className="flex items-start justify-between">
                  <div><p className="text-sm font-semibold text-gray-900">{n.title}</p><p className="text-sm text-gray-500 mt-1">{n.message}</p></div>
                  <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Send Notification" footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={send}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Message" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('sa.target')}</span><select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm"><option value="all">{t('sa.all_users')}</option><option value="admins">{t('sa.admins_only')}</option><option value="tenants">{t('sa.all_tenants_target')}</option></select></label>
        </div>
      </Modal>
    </div>
  );
}

function SaSystemSettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<{ platform_name: string; support_email: string; trial_days: number; max_tenants: number | null; maintenance_mode: boolean; maintenance_message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', true).single()
      .then(({ data }) => data && setSettings({
        platform_name: data.platform_name, support_email: data.support_email,
        trial_days: data.trial_days, max_tenants: data.max_tenants,
        maintenance_mode: data.maintenance_mode, maintenance_message: data.maintenance_message ?? '',
      }));
  }, []);

  const save = async () => {
    if (!settings) return;
    setErr(null);
    const { error } = await supabase.from('platform_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', true);
    if (error) { setErr(error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="max-w-2xl"><Card className="p-6 text-sm text-gray-400">Loading...</Card></div>;

  return (
    <div className="max-w-2xl">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-2"><SettingsIcon size={24} className="text-gray-600" /><h3 className="font-semibold text-gray-900">{t('sa.system_settings')}</h3></div>
        <p className="text-xs text-gray-400 mb-6">These settings are stored in the database and take effect immediately across the whole platform -- they are not just displayed, they are actually enforced (trial length on new signups, maintenance mode blocking non-admin access, the maximum tenant count).</p>
        <div className="space-y-4">
          <Input label="Platform Name" value={settings.platform_name} onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })} />
          <Input label="Support Email" type="email" value={settings.support_email} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Trial Days (applies to new signups)" type="number" value={String(settings.trial_days)} onChange={(e) => setSettings({ ...settings, trial_days: parseInt(e.target.value) || 1 })} />
            <Input label="Max Tenants (blank = unlimited)" type="number" value={settings.max_tenants === null ? '' : String(settings.max_tenants)} onChange={(e) => setSettings({ ...settings, max_tenants: e.target.value === '' ? null : parseInt(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.maintenance_mode} onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })} className="accent-blue-600" /> <span className="text-sm text-gray-700">Maintenance Mode (blocks all non-super-admin access)</span></label>
          {settings.maintenance_mode && <Input label="Maintenance message shown to users" value={settings.maintenance_message} onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })} />}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={save} className="w-full">{t('sa.save_settings')}</Button>
          {saved && <p className="text-sm text-emerald-600 text-center">Settings saved and now active platform-wide.</p>}
        </div>
      </Card>
    </div>
  );
}
