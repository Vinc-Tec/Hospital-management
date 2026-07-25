import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { AuthProvider, useAuth, isProtectedSuperAdminEmail } from './lib/auth';
import { I18nProvider } from './lib/i18n';
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
import { SettingsPage } from './pages/Settings';
import { AboutPage, FeaturesPage, PrivacyPage, TermsPage, ContactPage } from './pages/StaticPages';

function FullScreenLoader() {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50"><span className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, activeTenant, profile } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace />;

  // Super admins bypass onboarding, subscription, and tenant requirements
  if (profile?.is_super_admin && isProtectedSuperAdminEmail(user.email)) {
    return <>{children}</>;
  }

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
        <Route path="patients" element={<PatientsModule tenantId={tid} />} />
        <Route path="appointments" element={<AppointmentsModule tenantId={tid} />} />
        <Route path="doctors" element={<DoctorsModule tenantId={tid} />} />
        <Route path="records" element={<MedicalRecordsModule tenantId={tid} />} />
        <Route path="consultations" element={<ConsultationsModule tenantId={tid} />} />
        <Route path="prescriptions" element={<PrescriptionsModule tenantId={tid} />} />
        <Route path="lab" element={<LabModule tenantId={tid} />} />
        <Route path="radiology" element={<RadiologyModule tenantId={tid} />} />
        <Route path="pharmacy" element={<PharmacyModule tenantId={tid} />} />
        <Route path="beds" element={<BedsModule tenantId={tid} />} />
        <Route path="admissions" element={<AdmissionsModule tenantId={tid} />} />
        <Route path="invoices" element={<InvoicesModule tenantId={tid} />} />
        <Route path="reports" element={<ReportsModule tenantId={tid} />} />
        <Route path="staff" element={<StaffModule tenantId={tid} />} />
        <Route path="roles" element={<RolesModule tenantId={tid} />} />
        <Route path="performance" element={<PerformanceModule tenantId={tid} />} />
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
