import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode, useEffect, useState } from 'react';
import { AuthProvider, useAuth, isProtectedSuperAdminEmail, hasModuleAccess } from './lib/auth';
import { supabase } from './lib/supabase';
import { I18nProvider, useI18n } from './lib/i18n';
import { LandingPage } from './pages/Landing';
import { AuthPage } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { SuperAdmin } from './pages/SuperAdmin';
import { BillingGate, TrialBanner } from './pages/Billing';
import {
  PatientsModule, DoctorsModule, AppointmentsModule, MedicalRecordsModule,
  ConsultationsModule, PrescriptionsModule, LabModule, RadiologyModule,
  PharmacyModule, BedsModule, AdmissionsModule, InvoicesModule, StaffModule, RolesModule,
  ReportsModule, PerformanceModule,
} from './pages/modules';
import {
  SurgeriesModule, HRModule, LeaveModule, PayrollModule, InventoryModule,
  InsuranceModule, TelemedicineModule, EmergencyModule, ImmunizationsModule, DischargeModule,
} from './pages/modules_extra';
import { SettingsPage } from './pages/Settings';
import { AboutPage, FeaturesPage, PrivacyPage, TermsPage, ContactPage } from './pages/StaticPages';

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
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Maintenance in progress</h1>
        <p className="text-sm text-gray-500">{message || "Health Cloud is temporarily unavailable for scheduled maintenance. Please check back shortly."}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, activeTenant, profile } = useAuth();
  const maintenance = useMaintenanceMode();
  if (loading || maintenance.loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace />;

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
  const { activePlan, profile, user } = useAuth();
  const { t } = useI18n();
  // Super admins always have full access, regardless of any tenant's plan.
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user?.email)) return <>{children}</>;
  if (hasModuleAccess(activePlan, moduleKey)) return <>{children}</>;
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
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
