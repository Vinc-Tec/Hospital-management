import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, CreditCard, Globe, ScrollText, ShieldCheck,
  Check, X, AlertCircle, Eye, Ban, MessageSquarePlus, Users, TrendingUp,
  DollarSign, Ticket, UserPlus,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Tenant, type SubscriptionPlan, type AuditLog } from '../lib/supabase';
import { Button, Card, Input, Modal, Badge, EmptyState } from '../components/ui';
import { Logo, LangToggle, StatusBadge } from '../components/brand';

const SUPER_ADMIN_EMAILS = ['vincentnogue2@gmail.com', 'vincentnogue@yahoo.com', 'webdxb1@gmail.com', 'liyahjoha@gmail.com'];
const PROTECTED_EMAILS = ['webdxb1@gmail.com', 'liyahjoha@gmail.com'];

const NAV = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'tenants', icon: Building2 },
  { key: 'subscriptions', icon: CreditCard },
  { key: 'commercial', icon: Ticket },
  { key: 'accounting', icon: DollarSign },
  { key: 'users', icon: Users },
  { key: 'geography', icon: Globe },
  { key: 'audit', icon: ScrollText },
];

export function SuperAdmin() {
  const { t } = useI18n();
  const { profile, user } = useAuth();
  const loc = useLocation();
  const [section, setSection] = useState(loc.hash.replace('#', '') || 'overview');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [commercialCodes, setCommercialCodes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, suspended: 0, mrr: 0, totalRevenue: 0 });

  const loadAll = async () => {
    const [{ data: tns }, { data: pl }, { data: lg }, { data: cs }, { data: cc }, { data: pr }] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('countries').select('id, name').order('name'),
      supabase.from('commercial_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, is_super_admin').order('full_name'),
    ]);
    const tList = (tns as Tenant[]) ?? [];
    setTenants(tList);
    setPlans((pl as SubscriptionPlan[]) ?? []);
    setLogs((lg as AuditLog[]) ?? []);
    setCountries((cs as { id: string; name: string }[]) ?? []);
    setCommercialCodes(cc ?? []);
    setProfiles(pr ?? []);
    const activeTenants = tList.filter((x) => x.status === 'approved');
    setStats({
      total: tList.length,
      active: activeTenants.length,
      pending: tList.filter((x) => x.status === 'pending').length,
      suspended: tList.filter((x) => x.status === 'suspended').length,
      mrr: activeTenants.reduce((s, x) => s + (x.plan_id ? 100 : 0), 0),
      totalRevenue: activeTenants.reduce((s, x) => s + (x.plan_id ? 1200 : 0), 0),
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
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-gray-800"><Logo size={30} /></div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setSection(n.key)} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${section === n.key ? 'bg-emerald-600/20 text-emerald-400 font-medium' : 'hover:bg-gray-800'}`}>
              <n.icon size={18} /> {t(`sa.nav.${n.key}`)}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <Link to="/app" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800"><ShieldCheck size={18} /> {t('nav.dashboard')}</Link>
        </div>
      </aside>

      <div className="flex-1 bg-gray-50 overflow-y-auto">
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-6">
          <div className="flex items-center gap-3"><h1 className="font-semibold text-gray-900">{t('sa.title')}</h1><span className="text-xs text-gray-400">{user?.email}</span></div>
          <LangToggle />
        </header>
        <main className="p-6 lg:p-8">
          {section === 'overview' && <SaOverview stats={stats} tenants={tenants} />}
          {section === 'tenants' && <SaTenants tenants={tenants} onAction={loadAll} />}
          {section === 'subscriptions' && <SaSubscriptions tenants={tenants} plans={plans} onAction={loadAll} />}
          {section === 'commercial' && <SaCommercial codes={commercialCodes} onAction={loadAll} />}
          {section === 'accounting' && <SaAccounting tenants={tenants} plans={plans} />}
          {section === 'users' && <SaUsers profiles={profiles} tenants={tenants} onAction={loadAll} />}
          {section === 'geography' && <SaGeography countries={countries} regions={regions} setRegions={setRegions} onAction={loadAll} />}
          {section === 'audit' && <SaAudit logs={logs} />}
        </main>
      </div>
    </div>
  );
}

function SaOverview({ stats, tenants }: { stats: { total: number; active: number; pending: number; suspended: number; mrr: number; totalRevenue: number }; tenants: Tenant[] }) {
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
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">{t('sa.recent_tenants')}</h3>
        {tenants.length === 0 ? <EmptyState icon={Building2} title={t('common.none')} /> : (
          <div className="space-y-2">{tenants.slice(0, 10).map((tn) => <div key={tn.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div><p className="text-sm font-medium text-gray-900">{tn.commercial_name || tn.legal_name}</p><p className="text-xs text-gray-400">{tn.email}</p></div><StatusBadge status={tn.status} /></div>)}</div>
        )}
      </Card>
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
    await supabase.from('tenants').update({ plan_id: planId }).eq('id', selected.id);
    setSelected(null); onAction();
  };

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Institution</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
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

function SaCommercial({ codes, onAction }: { codes: any[]; onAction: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ country_iso: '', description: '', discount_percent: '10', max_uses: '', valid_until: '' });

  const generateCode = async (iso: string) => {
    const prefix = `HC-${iso.toUpperCase().slice(0,3)}`;
    const { count } = await supabase.from('commercial_codes').select('*', { count: 'exact', head: true }).like('code', `${prefix}-%`);
    const seq = String((count ?? 0) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  };

  const save = async () => {
    if (!form.country_iso) return;
    const code = await generateCode(form.country_iso);
    await supabase.from('commercial_codes').insert({
      code,
      description: form.description || null,
      discount_percent: parseFloat(form.discount_percent) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until || null,
      created_by: user?.id,
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
              <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Discount</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Uses</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
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

function SaAccounting({ tenants, plans }: { tenants: Tenant[]; plans: SubscriptionPlan[] }) {
  const { t } = useI18n();
  const active = tenants.filter((tn) => tn.status === 'approved');
  const totalMrr = active.reduce((s, tn) => {
    const plan = plans.find((p) => p.id === tn.plan_id);
    return s + (plan?.price_monthly ?? 0);
  }, 0);
  const totalArr = totalMrr * 12;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50"><DollarSign size={20} className="text-blue-600" /></div><p className="text-2xl font-bold text-gray-900">${totalMrr}</p><p className="text-sm text-gray-500">{t('sa.mrr')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-emerald-50"><TrendingUp size={20} className="text-emerald-600" /></div><p className="text-2xl font-bold text-gray-900">${totalArr}</p><p className="text-sm text-gray-500">{t('sa.arr')}</p></Card>
        <Card className="p-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-amber-50"><Building2 size={20} className="text-amber-600" /></div><p className="text-2xl font-bold text-gray-900">{active.length}</p><p className="text-sm text-gray-500">{t('sa.active_tenants')}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Institution</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Monthly</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Yearly</th></tr></thead>
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

function SaUsers({ profiles, tenants, onAction }: { profiles: any[]; tenants: Tenant[]; onAction: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', is_super_admin: false });

  const createStaff = async () => {
    const { data: authData, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.full_name } } });
    if (!error && authData.user) {
      await supabase.from('profiles').update({ full_name: form.full_name, is_super_admin: form.is_super_admin }).eq('id', authData.user.id);
    }
    setForm({ full_name: '', email: '', password: '', is_super_admin: false }); setOpen(false); onAction();
  };

  const toggleSuperAdmin = async (p: any) => {
    await supabase.from('profiles').update({ is_super_admin: !p.is_super_admin }).eq('id', p.id);
    onAction();
  };

  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><UserPlus size={16} /> {t('sa.add_staff')}</Button></div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Super Admin</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th></tr></thead>
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
                        {isProtected && <Badge color="blue">Protected</Badge>}
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
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_super_admin} onChange={(e) => setForm({ ...form, is_super_admin: e.target.checked })} className="accent-blue-600" /> <span className="text-sm text-gray-700">Super Admin</span></label>
        </div>
      </Modal>
    </div>
  );
}

function SaGeography({ countries, regions, setRegions, onAction }: { countries: { id: string; name: string }[]; regions: { id: string; name: string }[]; setRegions: (r: { id: string; name: string }[]) => void; onAction: () => void }) {
  const { t } = useI18n();
  const [cForm, setCForm] = useState({ name: '', iso2: '', phone_code: '', currency_code: '' });
  const [rForm, setRForm] = useState({ country_id: '', name: '' });
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
