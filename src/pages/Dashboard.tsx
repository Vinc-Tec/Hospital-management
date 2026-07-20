import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FileText, ClipboardList, Pill,
  FlaskConical, ScanLine, BedDouble, LogIn, Receipt, UserCog, ShieldCheck, Settings,
  Plus, LogOut, Menu, X, ChevronRight, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Patient, type Appointment } from '../lib/supabase';
import { Button, Card, Modal, Input, Select, EmptyState } from '../components/ui';
import { Logo, LangToggle, StatusBadge } from '../components/brand';

const NAV = [
  { to: '/app', icon: LayoutDashboard, key: 'dash.nav.overview' },
  { to: '/app/patients', icon: Users, key: 'dash.nav.patients' },
  { to: '/app/appointments', icon: CalendarDays, key: 'dash.nav.appointments' },
  { to: '/app/doctors', icon: Stethoscope, key: 'dash.nav.doctors' },
  { to: '/app/records', icon: FileText, key: 'dash.nav.records' },
  { to: '/app/consultations', icon: ClipboardList, key: 'dash.nav.consultations' },
  { to: '/app/prescriptions', icon: Pill, key: 'dash.nav.prescriptions' },
  { to: '/app/lab', icon: FlaskConical, key: 'dash.nav.lab' },
  { to: '/app/radiology', icon: ScanLine, key: 'dash.nav.radiology' },
  { to: '/app/pharmacy', icon: Pill, key: 'dash.nav.pharmacy' },
  { to: '/app/beds', icon: BedDouble, key: 'dash.nav.beds' },
  { to: '/app/invoices', icon: Receipt, key: 'dash.nav.invoices' },
  { to: '/app/staff', icon: UserCog, key: 'dash.nav.staff' },
  { to: '/app/roles', icon: ShieldCheck, key: 'dash.nav.roles' },
  { to: '/app/settings', icon: Settings, key: 'dash.nav.settings' },
];

export function Dashboard({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const { user, profile, activeTenant, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({ patients: 0, appointments: 0, doctors: 0, revenue: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [pForm, setPForm] = useState({ first_name: '', last_name: '', phone: '', gender: 'male', date_of_birth: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;
    (async () => {
      const tid = activeTenant.id;
      const [{ data: p }, { data: a }, { count: pc }, { count: ac }, { count: dc }] = await Promise.all([
        supabase.from('patients').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }).limit(5),
        supabase.from('appointments').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }).limit(5),
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('tenant_id', tid),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', tid),
        supabase.from('doctors').select('*', { count: 'exact', head: true }).eq('tenant_id', tid),
      ]);
      setPatients((p as Patient[]) ?? []);
      setAppointments((a as Appointment[]) ?? []);
      setStats({ patients: pc ?? 0, appointments: ac ?? 0, doctors: dc ?? 0, revenue: 0 });
    })();
  }, [activeTenant]);

  const addPatient = async () => {
    if (!activeTenant) return;
    setSaving(true);
    const { error } = await supabase.from('patients').insert({ ...pForm, tenant_id: activeTenant.id });
    if (!error) { setAddOpen(false); setPForm({ first_name: '', last_name: '', phone: '', gender: 'male', date_of_birth: '' }); }
    setSaving(false);
  };

  const isOverview = loc.pathname === '/app';
  const trialEnd = activeTenant?.trial_ends_at ? new Date(activeTenant.trial_ends_at).toLocaleDateString() : '';

  const kpis = [
    { label: t('dash.patients'), value: stats.patients, icon: Users, color: 'blue' },
    { label: t('dash.appointments'), value: stats.appointments, icon: CalendarDays, color: 'emerald' },
    { label: t('dash.doctors'), value: stats.doctors, icon: Stethoscope, color: 'amber' },
    { label: t('dash.revenue'), value: `$${stats.revenue}`, icon: Receipt, color: 'gray' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center px-4 border-b border-gray-100"><Logo size={32} /></div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((n) => {
            const active = loc.pathname === n.to;
            return (
              <Link key={n.to} to={n.to} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                <n.icon size={18} /> {t(n.key)}
              </Link>
            );
          })}
          {profile?.is_super_admin && (
            <Link to="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 font-medium">
              <ShieldCheck size={18} /> Super Admin
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => { signOut(); nav('/'); }} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <LogOut size={18} /> {t('nav.signout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"><Menu size={20} /></button>
            <div>
              <p className="text-sm font-semibold text-gray-900">{activeTenant?.commercial_name || activeTenant?.legal_name || t('dash.tenant')}</p>
              {activeTenant && <div className="flex items-center gap-2 mt-0.5"><StatusBadge status={activeTenant.status} />{trialEnd && <span className="text-xs text-gray-400">{t('dash.trial')} {trialEnd}</span>}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={16} /> {t('dash.nav.patients')}</Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children ?? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{t('dash.welcome')}, {profile?.full_name || user?.email}</h1>
                <p className="text-sm text-gray-500 mt-1">{activeTenant?.healthcare_type}</p>
              </div>

              {activeTenant?.status === 'pending' && (
                <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">{t('dash.status.pending')}. {t('dash.trial')} {trialEnd}</p>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {kpis.map((k, i) => (
                  <Card key={i} className="p-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${k.color}-50`}><k.icon size={20} className={`text-${k.color}-600`} /></div>
                    <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                    <p className="text-sm text-gray-500">{k.label}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">{t('dash.nav.patients')}</h3><Link to="/app/patients" className="text-xs text-blue-600 flex items-center gap-1">View all <ChevronRight size={12} /></Link></div>
                  {patients.length === 0 ? <EmptyState icon={Users} title={t('common.none')} /> : (
                    <div className="space-y-2">{patients.map((p) => <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div><p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p><p className="text-xs text-gray-400">{p.phone || '—'}</p></div>{p.gender && <StatusBadge status={p.gender} />}</div>)}</div>
                  )}
                </Card>
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">{t('dash.nav.appointments')}</h3><Link to="/app/appointments" className="text-xs text-blue-600 flex items-center gap-1">View all <ChevronRight size={12} /></Link></div>
                  {appointments.length === 0 ? <EmptyState icon={CalendarDays} title={t('common.none')} /> : (
                    <div className="space-y-2">{appointments.map((a) => <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><div><p className="text-sm font-medium text-gray-900">{a.reason || 'Appointment'}</p><p className="text-xs text-gray-400">{new Date(a.scheduled_at).toLocaleDateString()}</p></div><StatusBadge status={a.status} /></div>)}</div>
                  )}
                </Card>
              </div>
            </>
          )}
        </main>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('common.add')} footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button><Button onClick={addPatient} loading={saving}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" required value={pForm.first_name} onChange={(e) => setPForm({ ...pForm, first_name: e.target.value })} />
            <Input label="Last name" required value={pForm.last_name} onChange={(e) => setPForm({ ...pForm, last_name: e.target.value })} />
          </div>
          <Input label="Phone" value={pForm.phone} onChange={(e) => setPForm({ ...pForm, phone: e.target.value })} />
          <Select label="Gender" value={pForm.gender} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} onChange={(e) => setPForm({ ...pForm, gender: e.target.value })} />
          <Input label="Date of birth" type="date" value={pForm.date_of_birth} onChange={(e) => setPForm({ ...pForm, date_of_birth: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
