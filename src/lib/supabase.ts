import { createClient } from '@supabase/supabase-js';

// Custom storage adapter for the "remember me" checkbox on sign-in: when
// remember=false we keep the session in sessionStorage (cleared when the
// tab closes) instead of localStorage (persists indefinitely). The flag
// itself lives in localStorage so it survives the getItem/setItem calls
// Supabase makes before our sign-in code runs. Falls back to whichever
// storage already holds a value on read, so existing persisted sessions
// keep working after this change ships.
export const REMEMBER_FLAG_KEY = 'hc-remember-session';
const rememberAwareStorage = {
  getItem: (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    const remember = localStorage.getItem(REMEMBER_FLAG_KEY) !== '0';
    (remember ? localStorage : sessionStorage).setItem(key, value);
    if (!remember) localStorage.removeItem(key);
  },
  removeItem: (key: string) => { localStorage.removeItem(key); sessionStorage.removeItem(key); },
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: rememberAwareStorage } }
);

export type Tenant = {
  id: string; legal_name: string; commercial_name: string | null;
  owner_user_id: string | null;
  healthcare_type: string; country_id: string | null; region_id: string | null;
  district_id: string | null; city_id: string | null; locality_id: string | null;
  address: string | null; gps_lat: number | null; gps_lng: number | null;
  email: string; phone: string | null; website: string | null;
  medical_license: string | null; business_registration: string | null;
  tax_certificate: string | null; owner_identification: string | null;
  insurance_documents: string | null; bank_information: Record<string, unknown> | null;
  payment_gateway: string | null; num_doctors: number; num_beds: number;
  departments: string[]; services: string[];
  status: 'pending' | 'approved' | 'rejected' | 'request_info' | 'suspended';
  verification_note: string | null; plan_id: string | null;
  trial_ends_at: string; grace_period_ends_at?: string | null;
  currency_code: string | null; timezone: string | null;
  accounting_mode: 'per_branch' | 'consolidated' | 'both' | null;
  created_at: string; updated_at: string;
};

export type Branch = {
  id: string; tenant_id: string; name: string; healthcare_type: string;
  is_head_office: boolean; address: string | null; phone: string | null; email: string | null;
  city_id: string | null; district_id: string | null; region_id: string | null; country_id: string | null;
  gps_lat: number | null; gps_lng: number | null;
  manager_name: string | null; manager_phone: string | null;
  status: 'active' | 'inactive' | 'suspended'; created_at: string;
};

export type SubscriptionPlan = {
  id: string; code: string; name: string; price_monthly: number; price_yearly: number;
  max_users: number; max_doctors: number; max_patients: number;
  max_branches: number; max_storage_gb: number;
  features: string[]; module_flags: Record<string, boolean>; is_active: boolean; sort_order: number;
};

export type TenantSubscription = {
  id: string; tenant_id: string; plan_id: string;
  billing_cycle: 'monthly' | 'yearly'; start_date: string; end_date: string | null;
  status: 'active' | 'cancelled' | 'suspended' | 'past_due' | 'trialing';
  payment_gateway: string | null; next_billing_date: string | null;
  auto_renew: boolean; cancelled_at: string | null; cancellation_reason: string | null;
  created_at: string; updated_at: string;
};

export type Payment = {
  id: string; tenant_id: string; subscription_id: string | null;
  amount: number; currency: string;
  gateway: 'stripe' | 'flutterwave' | 'paystack' | 'orange_money' | 'mtn_momo' | 'visa' | 'mastercard' | 'bank_transfer' | null;
  gateway_tx_id: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paid_at: string | null; invoice_url: string | null; metadata: Record<string, unknown> | null;
  created_at: string; updated_at: string;
};

export type BillingInvoice = {
  id: string; invoice_number: string; tenant_id: string; subscription_id: string | null;
  amount_due: number; amount_paid: number; due_date: string; paid_at: string | null;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  line_items: Record<string, unknown>[]; pdf_url: string | null; notes: string | null;
  created_at: string; updated_at: string;
};

export type Country = { id: string; name: string; iso2: string; phone_code: string | null; currency_code: string | null; timezone: string | null };
export type Region = { id: string; country_id: string; name: string };
export type District = { id: string; region_id: string; name: string };
export type City = { id: string; district_id: string; name: string };
export type Locality = { id: string; city_id: string; name: string };

export type Patient = {
  id: string; tenant_id: string; first_name: string; last_name: string;
  date_of_birth: string | null; gender: 'male' | 'female' | 'other' | null;
  phone: string | null; email: string | null; blood_group: string | null;
  allergies: string | null; created_at: string;
};

export type Doctor = {
  id: string; tenant_id: string; first_name: string; last_name: string;
  specialty: string | null; email: string | null; phone: string | null;
  license_number: string | null; status: 'active' | 'suspended' | 'inactive'; created_at: string;
};

export type Appointment = {
  id: string; tenant_id: string; patient_id: string | null; doctor_id: string | null;
  scheduled_at: string; duration_min: number; reason: string | null;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'; created_at: string;
};

export type MedicalRecord = {
  id: string; tenant_id: string; patient_id: string; doctor_id: string | null;
  record_date: string; chief_complaint: string | null; history: string | null;
  examination: string | null; diagnosis: string | null; icd10_code: string | null;
  notes: string | null; created_at: string;
};

export type Consultation = {
  id: string; tenant_id: string; patient_id: string; doctor_id: string | null;
  consult_date: string; subjective: string | null; objective: string | null;
  assessment: string | null; plan: string | null; follow_up: string | null; created_at: string;
};

export type Prescription = {
  id: string; tenant_id: string; patient_id: string; doctor_id: string | null;
  medication: string; dosage: string | null; frequency: string | null;
  duration: string | null; notes: string | null;
  status: 'active' | 'dispensed' | 'cancelled'; created_at: string;
};

export type LabOrder = {
  id: string; tenant_id: string; patient_id: string; doctor_id: string | null;
  test_name: string; test_code: string | null;
  status: 'ordered' | 'collected' | 'resulted' | 'validated' | 'cancelled';
  result: string | null; reference_values: string | null; attachment_path: string | null;
  ordered_at: string; resulted_at: string | null; created_at: string;
};

export type RadiologyOrder = {
  id: string; tenant_id: string; patient_id: string; doctor_id: string | null;
  modality: string; body_part: string;
  status: 'ordered' | 'performed' | 'reported' | 'validated' | 'cancelled';
  report: string | null; attachment_path: string | null; ordered_at: string; reported_at: string | null; created_at: string;
};

export type PharmacyItem = {
  id: string; tenant_id: string; name: string; generic_name: string | null;
  form: string | null; strength: string | null; batch_number: string | null;
  expiry_date: string | null; quantity: number; reorder_level: number;
  unit_price: number; created_at: string;
};

export type Bed = {
  id: string; tenant_id: string; ward: string; room: string; bed_number: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
  patient_id: string | null; created_at: string;
};

export type Admission = {
  id: string; tenant_id: string; patient_id: string; bed_id: string | null;
  doctor_id: string | null; admission_date: string; discharge_date: string | null;
  reason: string | null; status: 'admitted' | 'discharged' | 'transferred';
  notes: string | null; created_at: string;
};

export type Invoice = {
  id: string; tenant_id: string; patient_id: string | null; invoice_number: string;
  issue_date: string; due_date: string | null; subtotal: number; tax: number;
  total: number; status: 'unpaid' | 'paid' | 'partial' | 'cancelled' | 'refunded';
  notes: string | null; created_at: string;
};

export type Role = {
  id: string; tenant_id: string; name: string; description: string | null;
  permissions: Record<string, unknown>; is_system: boolean; created_at: string;
};

export type Staff = {
  id: string; tenant_id: string; first_name: string; last_name: string;
  role: string | null; department: string | null; email: string | null;
  phone: string | null; status: 'active' | 'suspended' | 'inactive'; created_at: string;
};

export type Notification = {
  id: string; tenant_id: string | null; user_id: string; title: string;
  body: string | null; type: string; read: boolean; created_at: string;
};

export type Surgery = {
  id: string; tenant_id: string; patient_id: string; surgeon_id: string | null;
  operating_room: string; procedure_name: string; scheduled_at: string; duration_minutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed'; notes: string | null;
};
export type EmployeeRecord = {
  id: string; tenant_id: string; staff_id: string;
  contract_type: 'full_time' | 'part_time' | 'contractor' | 'intern';
  hire_date: string; termination_date: string | null; base_salary: number; currency: string;
  emergency_contact: string | null; notes: string | null;
};
export type LeaveRequest = {
  id: string; tenant_id: string; staff_id: string;
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  start_date: string; end_date: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; reason: string | null;
};
export type Payslip = {
  id: string; tenant_id: string; staff_id: string; period_month: string;
  gross_salary: number; deductions: number; net_salary: number;
  status: 'draft' | 'approved' | 'paid'; notes: string | null;
};
export type InventoryItem = {
  id: string; tenant_id: string; name: string;
  category: 'equipment' | 'consumable' | 'furniture' | 'it' | 'other';
  sku: string | null; quantity: number; reorder_level: number; unit_price: number; location: string | null;
};
export type InsuranceClaim = {
  id: string; tenant_id: string; patient_id: string; invoice_id: string | null;
  provider_name: string; policy_number: string | null; claim_amount: number; approved_amount: number | null;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'; notes: string | null; submitted_at: string;
};
export type TelemedicineSession = {
  id: string; tenant_id: string; patient_id: string; doctor_id: string | null;
  scheduled_at: string; video_link: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'; notes: string | null;
};
export type EmergencyCase = {
  id: string; tenant_id: string; patient_id: string | null; walk_in_name: string | null;
  triage_level: 'critical' | 'urgent' | 'standard' | 'minor'; chief_complaint: string; arrival_time: string;
  status: 'waiting' | 'in_treatment' | 'admitted' | 'discharged' | 'deceased' | 'transferred'; notes: string | null;
};
export type Immunization = {
  id: string; tenant_id: string; patient_id: string; vaccine_name: string; dose_number: number;
  date_administered: string; next_due_date: string | null; administered_by: string | null; notes: string | null;
};
export type DischargeSummary = {
  id: string; tenant_id: string; admission_id: string | null; patient_id: string; doctor_id: string | null;
  summary: string; follow_up_instructions: string | null; referral_to: string | null; discharged_at: string;
};

export type Profile = { id: string; full_name: string | null; is_super_admin: boolean; email: string | null };
export type Membership = {
  id: string; tenant_id: string; user_id: string; role: string;
  permissions: Record<string, unknown>;
};

export type AuditLog = {
  id: string; tenant_id: string | null; actor_user_id: string | null;
  action: string; entity_type: string | null; entity_id: string | null;
  details: Record<string, unknown>; created_at: string;
};

export type Integration = {
  id: string; tenant_id: string;
  provider: 'whatsapp' | 'sms' | 'google_calendar' | 'slack' | 'flutterwave' | 'webhook_generic' | 'telegram';
  name: string; config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  created_at: string; updated_at: string;
};
export type Webhook = {
  id: string; tenant_id: string; name: string; url: string; event: string;
  secret: string | null; is_active: boolean; last_triggered_at: string | null; created_at: string;
};
