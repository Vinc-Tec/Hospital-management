import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, CreditCard, Globe, ScrollText, ShieldCheck,
  Check, X, AlertCircle, Eye, Ban, MessageSquarePlus,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Tenant, type SubscriptionPlan, type AuditLog } from '../lib/supabase';
import { Button, Card, Input, Modal, Badge, EmptyState } from '../components/ui';
import { Logo, StatusBadge } from '../components/brand';

const NAV = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'tenants', icon: Building2 },
  { key: 'plans', icon: CreditCard },
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
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, suspended: 0, mrr: 0 });

  const loadAll = async () => {
    const [{ data: tns }, { data: pl }, { data: lg }, { data: cs }] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('countries').select('id, name').order('name'),
    ]);
    const tList = (tns as Tenant[]) ?? [];
    setTenants(tList);
    setPlans((pl as SubscriptionPlan[]) ?? []);
    setLogs((lg as AuditLog[]) ?? []);
    setCountries((cs as { id: string; name: string }[]) ?? []);
    setStats({
      total: tList.length,
      active: tList.filter((x) => x.status === 'approved').length,
      pending: tList.filter((x) => x.status === 'pending').length,
      suspended: tList.filter((x) => x.status === 'suspended').length,
      mrr: tList.filter((x) => x.status === 'approved').reduce((s, x) => s + (x.plan_id ? 100 : 0), 0),
    });
  };
  useEffect(() => { loadAll(); }, []);

  if (!profile?.is_super_admin) {
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
        <nav className="flex-1 p-3 space-y-0.5">
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
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center px-6">
          <h1 className="font-semibold text-gray-900">{t('sa.title')}</h1>
          <span className="ml-3 text-xs text-gray-400">{user?.email}</span>
        </header>
        <main className="p-6 lg:p-8">
          {section === 'overview' && <SaOverview stats={stats} tenants={tenants} />}
          {section === 'tenants' && <SaTenants tenants={tenants} onAction={loadAll} />}
          {section === 'plans' && <SaPlans plans={plans} onAction={loadAll} />}
          {section === 'geography' && <SaGeography countries={countries} regions={regions} setRegions={setRegions} onAction={loadAll} />}
          {section === 'audit' && <SaAudit logs={logs} />}
        </main>
      </div>
    </div>
  );
}

function SaOverview({ stats, tenants }: { stats: { total: number; active: number; pending: number; suspended: number; mrr: number }; tenants: Tenant[] }) {
  const { t } = useI18n();
  const kpis = [
    { label: t('sa.active_tenants'), value: stats.active, color: 'emerald' },
    { label: t('sa.pending'), value: stats.pending, color: 'amber' },
    { label: t('sa.suspended'), value: stats.suspended, color: 'red' },
    { label: t('sa.mrr'), value: `$${stats.mrr}`, color: 'blue' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <Card key={i} className="p-5"><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${k.color}-50`}><Building2 size={20} className={`text-${k.color}-600`} /></div><p className="text-2xl font-bold text-gray-900">{k.value}</p><p className="text-sm text-gray-500">{k.label}</p></Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Recent institutions</h3>
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

function SaPlans({ plans, onAction }: { plans: SubscriptionPlan[]; onAction: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', price_monthly: '0', price_yearly: '0', max_users: '0', max_doctors: '0', max_patients: '0', features: '' });
  const save = async () => {
    await supabase.from('subscription_plans').insert({ code: form.code, name: form.name, price_monthly: parseFloat(form.price_monthly), price_yearly: parseFloat(form.price_yearly), max_users: parseInt(form.max_users), max_doctors: parseInt(form.max_doctors), max_patients: parseInt(form.max_patients), features: form.features.split(',').map((s) => s.trim()), is_active: true, sort_order: plans.length + 1 });
    setOpen(false); onAction();
  };
  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><CreditCard size={16} /> {t('sa.add_plan')}</Button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <h3 className="font-bold text-gray-900">{p.name}</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">${p.price_monthly}<span className="text-sm text-gray-400">/mo</span></p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">{p.features?.map((f, i) => <li key={i}>• {f}</li>)}</ul>
            <div className="mt-3 flex gap-2 text-xs text-gray-400"><span>U:{p.max_users}</span><span>D:{p.max_doctors}</span><span>P:{p.max_patients}</span></div>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('sa.add_plan')} footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('sa.plan_code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label={t('sa.plan_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('sa.price_monthly')} type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
          <Input label={t('sa.price_yearly')} type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
          <Input label={t('sa.max_users')} type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
          <Input label={t('sa.max_doctors')} type="number" value={form.max_doctors} onChange={(e) => setForm({ ...form, max_doctors: e.target.value })} />
          <Input label={t('sa.max_patients')} type="number" value={form.max_patients} onChange={(e) => setForm({ ...form, max_patients: e.target.value })} />
          <Input label={t('sa.features')} placeholder="comma separated" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
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
    const { data } = await supabase.from('regions').select('id, name').eq('country_id', rForm.country_id).order('name');
    setRegions((data as { id: string; name: string }[]) ?? []);
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
          <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{t('onb.country')}</span><select value={rForm.country_id} onChange={(e) => setRForm({ ...rForm, country_id: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm"><option value="">...</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
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
