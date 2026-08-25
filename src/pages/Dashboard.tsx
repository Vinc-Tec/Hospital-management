import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FileText, ClipboardList, Pill,
  FlaskConical, ScanLine, BedDouble, LogIn, Receipt, UserCog, ShieldCheck, Settings,
  Plus, LogOut, Menu, ChevronRight, AlertCircle, FileBarChart, TrendingUp, Clock,
  Scissors, Briefcase, CalendarOff, Wallet, Boxes, ShieldPlus, Video, Siren, Syringe, FileOutput, Bell, MessageCircle, Send, Plug,
} from 'lucide-react';
import { useAuth, hasModuleAccess, hasRoleAccess } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase, type Patient, type Appointment, type Tenant } from '../lib/supabase';
import { Button, Card, Modal, Input, Select, EmptyState } from '../components/ui';
import { Logo, LangToggle, StatusBadge } from '../components/brand';
import { TrialBanner } from './Billing';
import { Footer } from '../components/Footer';
import { matchFaq } from '../lib/supportFaq';

const NAV = [
  { to: '/app', icon: LayoutDashboard, key: 'dash.nav.overview', moduleKey: 'overview' },
  { to: '/app/patients', icon: Users, key: 'dash.nav.patients', moduleKey: 'patients' },
  { to: '/app/appointments', icon: CalendarDays, key: 'dash.nav.appointments', moduleKey: 'appointments' },
  { to: '/app/doctors', icon: Stethoscope, key: 'dash.nav.doctors', moduleKey: 'doctors' },
  { to: '/app/records', icon: FileText, key: 'dash.nav.records', moduleKey: 'records' },
  { to: '/app/consultations', icon: ClipboardList, key: 'dash.nav.consultations', moduleKey: 'consultations' },
  { to: '/app/prescriptions', icon: Pill, key: 'dash.nav.prescriptions', moduleKey: 'prescriptions' },
  { to: '/app/lab', icon: FlaskConical, key: 'dash.nav.lab', moduleKey: 'lab' },
  { to: '/app/radiology', icon: ScanLine, key: 'dash.nav.radiology', moduleKey: 'radiology' },
  { to: '/app/pharmacy', icon: Pill, key: 'dash.nav.pharmacy', moduleKey: 'pharmacy' },
  { to: '/app/beds', icon: BedDouble, key: 'dash.nav.beds', moduleKey: 'beds' },
  { to: '/app/admissions', icon: LogIn, key: 'dash.nav.admissions', moduleKey: 'admissions' },
  { to: '/app/surgeries', icon: Scissors, key: 'dash.nav.surgeries', moduleKey: 'surgeries' },
  { to: '/app/emergency', icon: Siren, key: 'dash.nav.emergency', moduleKey: 'emergency' },
  { to: '/app/telemedicine', icon: Video, key: 'dash.nav.telemedicine', moduleKey: 'telemedicine' },
  { to: '/app/immunizations', icon: Syringe, key: 'dash.nav.immunizations', moduleKey: 'immunizations' },
  { to: '/app/discharge', icon: FileOutput, key: 'dash.nav.discharge', moduleKey: 'discharge' },
  { to: '/app/insurance', icon: ShieldPlus, key: 'dash.nav.insurance', moduleKey: 'insurance' },
  { to: '/app/invoices', icon: Receipt, key: 'dash.nav.invoices', moduleKey: 'invoices' },
  { to: '/app/inventory', icon: Boxes, key: 'dash.nav.inventory', moduleKey: 'inventory' },
  { to: '/app/reports', icon: FileBarChart, key: 'dash.nav.reports', moduleKey: 'reports' },
  { to: '/app/staff', icon: UserCog, key: 'dash.nav.staff', moduleKey: 'staff' },
  { to: '/app/hr', icon: Briefcase, key: 'dash.nav.hr', moduleKey: 'hr' },
  { to: '/app/leave', icon: CalendarOff, key: 'dash.nav.leave', moduleKey: 'hr' },
  { to: '/app/payroll', icon: Wallet, key: 'dash.nav.payroll', moduleKey: 'payroll' },
  { to: '/app/roles', icon: ShieldCheck, key: 'dash.nav.roles', moduleKey: 'roles' },
  { to: '/app/performance', icon: TrendingUp, key: 'dash.nav.performance', moduleKey: 'performance' },
  { to: '/app/integrations', icon: Plug, key: 'dash.nav.integrations', moduleKey: 'integrations' },
  { to: '/app/settings', icon: Settings, key: 'dash.nav.settings', moduleKey: 'settings' },
];

function TrialDaysWidget({ tenant }: { tenant: Tenant }) {
  const { t } = useI18n();
  const now = new Date();
  const trialEnd = new Date(tenant.trial_ends_at);
  const days = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  if (tenant.plan_id || days <= 0) return null;
  const urgent = days <= 3;
  return (
    <div className={`mx-3 mb-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${urgent ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
      <Clock size={13} />
      <span className="font-medium">{days}d trial left</span>
      <Link to="/app/settings" className="ml-auto underline text-blue-600 font-semibold">{t('billing.subscribe_now')}</Link>
    </div>
  );
}

function NotificationBell() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('hc_seen_notifications') || '[]'));

  useEffect(() => {
    supabase.from('platform_notifications').select('id, title, message, created_at, target')
      .in('target', ['all', 'tenants']).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setNotifications((data as typeof notifications) ?? []));
  }, []);

  const unreadCount = notifications.filter((n) => !seenIds.includes(n.id)).length;
  const markAllSeen = () => {
    const ids = notifications.map((n) => n.id);
    setSeenIds(ids);
    localStorage.setItem('hc_seen_notifications', JSON.stringify(ids));
  };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open) markAllSeen(); }} className="relative p-1.5 rounded-lg hover:bg-gray-100">
        <Bell size={18} className="text-gray-500" />
        {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadCount}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-40">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center">{t('common.no_notifications')}</p>
            ) : notifications.map((n) => (
              <div key={n.id} className="p-3 border-b border-gray-50 last:border-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-gray-300 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);
  if (!offline) return null;
  return (
    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
      <AlertCircle size={16} />
      {t('dash.offline_banner')}
    </div>
  );
}

type ChatMessage = { from: 'user' | 'bot'; text: string };

function SupportChatWidget() {
  const { t, lang } = useI18n();
  const { user, activeTenant } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ from: 'bot', text: t('chat.greeting') }]);
  const [awaitingEscalation, setAwaitingEscalation] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const send = async () => {
    const query = input.trim();
    if (!query) return;
    setMessages((m) => [...m, { from: 'user', text: query }]);
    setInput('');

    if (awaitingEscalation) {
      setEscalating(true);
      const { error } = await supabase.from('support_tickets').insert({
        tenant_id: activeTenant?.id ?? null, user_id: user!.id,
        subject: t('chat.escalated_subject'), description: query, priority: 'medium', status: 'open',
      });
      setEscalating(false);
      setAwaitingEscalation(false);
      setMessages((m) => [...m, { from: 'bot', text: error ? t('chat.escalation_failed') : t('chat.escalated_confirm') }]);
      return;
    }

    const match = matchFaq(query, lang as 'fr' | 'en');
    if (match) {
      setMessages((m) => [...m, { from: 'bot', text: match.answer[lang as 'fr' | 'en'] }]);
    } else {
      setMessages((m) => [...m, { from: 'bot', text: t('chat.no_match') }]);
      setAwaitingEscalation(true);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 w-80 sm:w-96 h-[28rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-semibold">{t('chat.title')}</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.from === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                {m.text}
              </div>
            ))}
            {escalating && <div className="text-xs text-gray-400 px-2">{t('common.loading')}</div>}
          </div>
          <div className="p-2 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('chat.placeholder')} className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={send} className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Send size={16} /></button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors">
        <MessageCircle size={24} />
      </button>
    </div>
  );
}

export function Dashboard() {
  const { t } = useI18n();
  const { user, profile, activeTenant, activePlan, activeMembership, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({ patients: 0, appointments: 0, doctors: 0, revenue: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [pForm, setPForm] = useState({ first_name: '', last_name: '', phone: '', gender: 'male', date_of_birth: '' });
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = profile?.is_super_admin;

  useEffect(() => {
    if (!activeTenant || isSuperAdmin) return;
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
  }, [activeTenant, isSuperAdmin]);

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
        <div className="h-16 flex items-center px-4 border-b border-gray-100 flex-shrink-0"><Logo size={32} /></div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.filter((n) => profile?.is_super_admin || (hasModuleAccess(activePlan, n.moduleKey) && hasRoleAccess(activeMembership?.permissions, n.moduleKey))).map((n) => {
            const active = loc.pathname === n.to;
            return (
              <Link key={n.to} to={n.to} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                <n.icon size={17} className={active ? 'text-blue-600' : ''} /> {t(n.key)}
              </Link>
            );
          })}
          {profile?.is_super_admin && (
            <Link to="/admin" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-emerald-700 hover:bg-emerald-50 font-medium mt-2 border-t border-gray-100 pt-3">
              <ShieldCheck size={17} /> {t('nav.superadmin')}
            </Link>
          )}
        </nav>
        {activeTenant && <TrialDaysWidget tenant={activeTenant} />}
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{profile?.full_name || user?.email}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={() => { signOut(); nav('/'); }}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <LogOut size={17} /> {t('nav.signout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <TrialBanner />
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"><Menu size={20} /></button>
            <div>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[160px] sm:max-w-xs">{activeTenant?.commercial_name || activeTenant?.legal_name || t('dash.tenant')}</p>
              {activeTenant && (
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={activeTenant.status} />
                  {trialEnd && !activeTenant.plan_id && <span className="text-xs text-gray-400">{t('dash.trial')} {trialEnd}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LangToggle />
            {isOverview && <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={16} /> <span className="hidden sm:inline">{t('dash.quickadd.patient')}</span></Button>}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <OfflineBanner />
          {isOverview ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{t('dash.welcome')}, {profile?.full_name || user?.email?.split('@')[0]}</h1>
                <p className="text-sm text-gray-500 mt-1">{isSuperAdmin ? 'Super Admin — LiAfrik' : activeTenant?.healthcare_type}</p>
              </div>

              {isSuperAdmin && (
                <div className="mb-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={24} className="text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-800">{t('dash.super_admin_access')}</p>
                      <p className="text-sm text-emerald-600 mt-1">You have unrestricted platform access. No subscription or onboarding is required. Use the Super Admin link in the sidebar to manage institutions, plans, and platform settings.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTenant?.status === 'pending' && (
                <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{t('dash.status.pending')}</p>
                    <p className="text-xs text-amber-600 mt-0.5">{t('dash.trial')} {trialEnd}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {kpis.map((k, i) => (
                  <Card key={i} className="p-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${k.color}-50`}>
                      <k.icon size={20} className={`text-${k.color}-600`} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{k.label}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{t('dash.nav.patients')}</h3>
                    <Link to="/app/patients" className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700">{t('dash.viewall')} <ChevronRight size={12} /></Link>
                  </div>
                  {patients.length === 0 ? <EmptyState icon={Users} title={t('common.none')} /> : (
                    <div className="space-y-2">
                      {patients.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                            <p className="text-xs text-gray-400">{p.phone || '—'}</p>
                          </div>
                          {p.gender && <StatusBadge status={p.gender} />}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{t('dash.nav.appointments')}</h3>
                    <Link to="/app/appointments" className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700">{t('dash.viewall')} <ChevronRight size={12} /></Link>
                  </div>
                  {appointments.length === 0 ? <EmptyState icon={CalendarDays} title={t('common.none')} /> : (
                    <div className="space-y-2">
                      {appointments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{a.reason || t('dash.nav.appointments')}</p>
                            <p className="text-xs text-gray-400">{new Date(a.scheduled_at).toLocaleDateString()}</p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          ) : (
            <Outlet />
          )}
        </main>
        <Footer />
      </div>
      <SupportChatWidget />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('common.add')}
        footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button><Button onClick={addPatient} loading={saving}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('common.firstname')} required value={pForm.first_name} onChange={(e) => setPForm({ ...pForm, first_name: e.target.value })} />
            <Input label={t('common.lastname')} required value={pForm.last_name} onChange={(e) => setPForm({ ...pForm, last_name: e.target.value })} />
          </div>
          <Input label={t('common.phone')} value={pForm.phone} onChange={(e) => setPForm({ ...pForm, phone: e.target.value })} />
          <Select label={t('common.gender')} value={pForm.gender} options={[{ value: 'male', label: t('common.male') }, { value: 'female', label: t('common.female') }, { value: 'other', label: t('common.other') }]} onChange={(e) => setPForm({ ...pForm, gender: e.target.value })} />
          <Input label={t('common.dob')} type="date" value={pForm.date_of_birth} onChange={(e) => setPForm({ ...pForm, date_of_birth: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
