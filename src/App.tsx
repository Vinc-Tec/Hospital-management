import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode, useEffect, useState, Suspense, lazy, Component } from 'react';
import { AuthProvider, useAuth, isProtectedSuperAdminEmail, hasModuleAccess, hasRoleAccess } from './lib/auth';
import { supabase } from './lib/supabase';
import { CursorEffect } from './components/CursorEffect';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
    // Reports to Sentry only if VITE_SENTRY_DSN was configured (see main.tsx);
    // otherwise Sentry.captureException is a no-op.
    import('@sentry/react').then((Sentry) => Sentry.captureException(error));
  }
  render() {
    if (this.state.hasError) {
      const lang = (localStorage.getItem('hc_lang') || 'fr') === 'fr' ? 'fr' : 'en';
      const copy = lang === 'fr'
        ? { title: 'Une erreur est survenue', body: "Un problème inattendu s'est produit. Recharger la page résout généralement ce souci.", cta: 'Recharger' }
        : { title: 'Something went wrong', body: 'An unexpected error occurred. Reloading the page usually fixes it.', cta: 'Reload' };
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{copy.title}</h1>
            <p className="text-sm text-gray-500 mb-6">{copy.body}</p>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">
              {copy.cta}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { I18nProvider, useI18n } from './lib/i18n';

const LandingPage = lazy(() => import('./pages/Landing').then((m) => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.AuthPage })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin').then((m) => ({ default: m.SuperAdmin })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AboutPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.AboutPage })));
const FeaturesPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.FeaturesPage })));
const PrivacyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.TermsPage })));
const ContactPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.ContactPage })));

// BillingGate/TrialBanner stay eagerly loaded: they wrap every authenticated
// route and are needed immediately, so splitting them out would just move
// the same code into a different chunk fetched at the same time.
import { BillingGate, TrialBanner } from './pages/Billing';

const PatientsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.PatientsModule })));
const DoctorsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.DoctorsModule })));
const AppointmentsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.AppointmentsModule })));
const MedicalRecordsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.MedicalRecordsModule })));
const ConsultationsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.ConsultationsModule })));
const PrescriptionsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.PrescriptionsModule })));
const LabModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.LabModule })));
const RadiologyModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.RadiologyModule })));
const PharmacyModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.PharmacyModule })));
const BedsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.BedsModule })));
const AdmissionsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.AdmissionsModule })));
const InvoicesModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.InvoicesModule })));
const StaffModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.StaffModule })));
const RolesModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.RolesModule })));
const ReportsModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.ReportsModule })));
const PerformanceModule = lazy(() => import('./pages/modules').then((m) => ({ default: m.PerformanceModule })));

const SurgeriesModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.SurgeriesModule })));
const HRModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.HRModule })));
const LeaveModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.LeaveModule })));
const PayrollModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.PayrollModule })));
const InventoryModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.InventoryModule })));
const InsuranceModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.InsuranceModule })));
const TelemedicineModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.TelemedicineModule })));
const EmergencyModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.EmergencyModule })));
const ImmunizationsModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.ImmunizationsModule })));
const DischargeModule = lazy(() => import('./pages/modules_extra').then((m) => ({ default: m.DischargeModule })));

function FullScreenLoader() {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50"><span className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;
}

function useMaintenanceMode() {
  const [state, setState] = useState<{ loading: boolean; active: boolean; message: string | null }>({ loading: true, active: false, message: null });
  useEffect(() => {
    supabase.from('platform_settings').select('maintenance_mode, maintenance_message').eq('id', true).single()
      .then(({ data }) => setState({ loading: false, active: !!data?.maintenance_mode, message: data?.maintenance_message ?? null }));
  }, []);
  return state;
}

function MaintenanceScreen({ message }: { message: string | null }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('maintenance.title')}</h1>
        <p className="text-sm text-gray-500">{message || t('maintenance.default_message')}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, activeTenant, profile } = useAuth();
  const maintenance = useMaintenanceMode();
  const [mfaPending, setMfaPending] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setMfaPending(false); return; }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      setMfaPending(!!data && data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel);
    });
  }, [user]);

  if (loading || maintenance.loading || mfaPending === null) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace />;
  if (mfaPending) return <Navigate to="/signin" replace />;

  // Super admins bypass onboarding, subscription, tenant requirements, AND maintenance mode
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user.email)) {
    return <>{children}</>;
  }

  if (maintenance.active) return <MaintenanceScreen message={maintenance.message} />;

  if (!activeTenant) return <Navigate to="/onboarding" replace />;
  return <BillingGate>{children}</BillingGate>;
}

function TenantRoute({ children }: { children: ReactNode }) {
  const { user, loading, profile, activeTenant } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace />;

  // Super admins never need onboarding
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user.email)) {
    return <Navigate to="/admin" replace />;
  }

  // If user already has a tenant, never show onboarding again
  if (activeTenant) return <Navigate to="/app" replace />;

  return <>{children}</>;
}

function ModuleGate({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { activePlan, activeMembership, profile, user } = useAuth();
  const { t } = useI18n();
  // Super admins always have full access, regardless of any tenant's plan.
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user?.email)) return <>{children}</>;
  if (!hasModuleAccess(activePlan, moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('gate.title')}</h2>
        <p className="text-sm text-gray-500 max-w-sm mb-6">{t('gate.body')}</p>
        <a href="/app/settings#billing" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          {t('gate.cta')}
        </a>
      </div>
    );
  }
  if (!hasRoleAccess(activeMembership?.permissions, moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('gate.role_title')}</h2>
        <p className="text-sm text-gray-500 max-w-sm">{t('gate.role_body')}</p>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace />;
  if (!profile?.is_super_admin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { activeTenant } = useAuth();
  const tid = activeTenant?.id ?? '';
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<AuthPage mode="signin" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/onboarding" element={<TenantRoute><Onboarding /></TenantRoute>} />
      <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
        <Route index element={null} />
        <Route path="patients" element={<ModuleGate moduleKey="patients"><PatientsModule tenantId={tid} /></ModuleGate>} />
        <Route path="appointments" element={<ModuleGate moduleKey="appointments"><AppointmentsModule tenantId={tid} /></ModuleGate>} />
        <Route path="doctors" element={<ModuleGate moduleKey="doctors"><DoctorsModule tenantId={tid} /></ModuleGate>} />
        <Route path="records" element={<ModuleGate moduleKey="records"><MedicalRecordsModule tenantId={tid} /></ModuleGate>} />
        <Route path="consultations" element={<ModuleGate moduleKey="consultations"><ConsultationsModule tenantId={tid} /></ModuleGate>} />
        <Route path="prescriptions" element={<ModuleGate moduleKey="prescriptions"><PrescriptionsModule tenantId={tid} /></ModuleGate>} />
        <Route path="lab" element={<ModuleGate moduleKey="lab"><LabModule tenantId={tid} /></ModuleGate>} />
        <Route path="radiology" element={<ModuleGate moduleKey="radiology"><RadiologyModule tenantId={tid} /></ModuleGate>} />
        <Route path="pharmacy" element={<ModuleGate moduleKey="pharmacy"><PharmacyModule tenantId={tid} /></ModuleGate>} />
        <Route path="beds" element={<ModuleGate moduleKey="beds"><BedsModule tenantId={tid} /></ModuleGate>} />
        <Route path="admissions" element={<ModuleGate moduleKey="admissions"><AdmissionsModule tenantId={tid} /></ModuleGate>} />
        <Route path="invoices" element={<ModuleGate moduleKey="invoices"><InvoicesModule tenantId={tid} /></ModuleGate>} />
        <Route path="reports" element={<ModuleGate moduleKey="reports"><ReportsModule tenantId={tid} /></ModuleGate>} />
        <Route path="staff" element={<ModuleGate moduleKey="staff"><StaffModule tenantId={tid} /></ModuleGate>} />
        <Route path="roles" element={<ModuleGate moduleKey="roles"><RolesModule tenantId={tid} /></ModuleGate>} />
        <Route path="performance" element={<ModuleGate moduleKey="performance"><PerformanceModule tenantId={tid} /></ModuleGate>} />
        <Route path="surgeries" element={<ModuleGate moduleKey="surgeries"><SurgeriesModule tenantId={tid} /></ModuleGate>} />
        <Route path="hr" element={<ModuleGate moduleKey="hr"><HRModule tenantId={tid} /></ModuleGate>} />
        <Route path="leave" element={<ModuleGate moduleKey="hr"><LeaveModule tenantId={tid} /></ModuleGate>} />
        <Route path="payroll" element={<ModuleGate moduleKey="payroll"><PayrollModule tenantId={tid} /></ModuleGate>} />
        <Route path="inventory" element={<ModuleGate moduleKey="inventory"><InventoryModule tenantId={tid} /></ModuleGate>} />
        <Route path="insurance" element={<ModuleGate moduleKey="insurance"><InsuranceModule tenantId={tid} /></ModuleGate>} />
        <Route path="telemedicine" element={<ModuleGate moduleKey="telemedicine"><TelemedicineModule tenantId={tid} /></ModuleGate>} />
        <Route path="emergency" element={<ModuleGate moduleKey="emergency"><EmergencyModule tenantId={tid} /></ModuleGate>} />
        <Route path="immunizations" element={<ModuleGate moduleKey="immunizations"><ImmunizationsModule tenantId={tid} /></ModuleGate>} />
        <Route path="discharge" element={<ModuleGate moduleKey="discharge"><DischargeModule tenantId={tid} /></ModuleGate>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/admin" element={<AdminRoute><SuperAdmin /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CursorEffect />
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
