import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { LandingPage } from './pages/Landing';
import { AuthPage } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { SuperAdmin } from './pages/SuperAdmin';
import {
  PatientsModule, DoctorsModule, AppointmentsModule, MedicalRecordsModule,
  ConsultationsModule, PrescriptionsModule, LabModule, RadiologyModule,
  PharmacyModule, BedsModule, AdmissionsModule, InvoicesModule, StaffModule, RolesModule,
} from './pages/modules';
import { SettingsPage } from './pages/Settings';
import { AboutPage, FeaturesPage, PrivacyPage, TermsPage, ContactPage } from './pages/StaticPages';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, activeTenant } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (!activeTenant) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function TenantRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (!profile?.is_super_admin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function ModuleWrapper({ children }: { children: ReactNode }) {
  return <div className="p-4 sm:p-6 lg:p-8">{children}</div>;
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
      <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/app/patients" element={<ProtectedRoute><ModuleWrapper><PatientsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/appointments" element={<ProtectedRoute><ModuleWrapper><AppointmentsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/doctors" element={<ProtectedRoute><ModuleWrapper><DoctorsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/records" element={<ProtectedRoute><ModuleWrapper><MedicalRecordsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/consultations" element={<ProtectedRoute><ModuleWrapper><ConsultationsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/prescriptions" element={<ProtectedRoute><ModuleWrapper><PrescriptionsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/lab" element={<ProtectedRoute><ModuleWrapper><LabModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/radiology" element={<ProtectedRoute><ModuleWrapper><RadiologyModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/pharmacy" element={<ProtectedRoute><ModuleWrapper><PharmacyModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/beds" element={<ProtectedRoute><ModuleWrapper><BedsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/admissions" element={<ProtectedRoute><ModuleWrapper><AdmissionsModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/invoices" element={<ProtectedRoute><ModuleWrapper><InvoicesModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/staff" element={<ProtectedRoute><ModuleWrapper><StaffModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/roles" element={<ProtectedRoute><ModuleWrapper><RolesModule tenantId={tid} /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/app/settings" element={<ProtectedRoute><ModuleWrapper><SettingsPage /></ModuleWrapper></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><SuperAdmin /></AdminRoute>} />
      <Route path="/admin/*" element={<AdminRoute><SuperAdmin /></AdminRoute>} />
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
