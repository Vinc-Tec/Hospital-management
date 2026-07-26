/*
# Missing modules + real plan-based access control

## Why
An audit found that (a) several modules advertised in paid plans (Operating
Room, HR, Payroll, Inventory) did not exist anywhere in the schema, and
(b) the `subscription_plans.features` column was purely decorative — every
tenant saw every module regardless of plan, and max_users/max_doctors/
max_patients were displayed but never enforced.

## What this migration does
1. Adds 10 new tenant-scoped clinical/operational tables, each with the
   same tenant-isolation RLS pattern used throughout the rest of the schema.
2. Adds `module_flags` (jsonb) to `subscription_plans` — an explicit,
   machine-readable map of which modules each plan unlocks. The frontend
   must filter navigation/routes against this, it is not just marketing copy.
3. Adds trigger-enforced limits for max_users / max_doctors / max_patients
   so a plan's limits are real constraints, not just displayed numbers.
   A limit of 0 means "unlimited" (matches the existing seed convention).

## Explicitly out of scope of this migration (flagged, not silently skipped)
- HL7/FHIR interoperability, PACS/DICOM image storage, structured ICD-10
  coding, and a drug-interaction engine are NOT included — these require
  external terminology/reference data and specialized infrastructure, not
  just new tables, and should not be represented as "done" by a migration.
- Real payment gateway integration (Stripe/Flutterwave/Paystack) — pending
  a live PSP account, tracked separately.
*/

-- ============================================================
-- 1. OPERATING ROOM / SURGERY SCHEDULING
-- ============================================================
CREATE TABLE IF NOT EXISTS surgeries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  surgeon_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  operating_room text NOT NULL,
  procedure_name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','postponed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS surgeries_tenant_idx ON surgeries(tenant_id, scheduled_at DESC);
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "surgeries_select" ON surgeries;
CREATE POLICY "surgeries_select" ON surgeries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id));
DROP POLICY IF EXISTS "surgeries_insert" ON surgeries;
CREATE POLICY "surgeries_insert" ON surgeries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id));
DROP POLICY IF EXISTS "surgeries_update" ON surgeries;
CREATE POLICY "surgeries_update" ON surgeries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id));
DROP POLICY IF EXISTS "surgeries_delete" ON surgeries;
CREATE POLICY "surgeries_delete" ON surgeries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id));

-- ============================================================
-- 2. HR — employee records (distinct from the basic `staff` directory)
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  contract_type text NOT NULL DEFAULT 'full_time' CHECK (contract_type IN ('full_time','part_time','contractor','intern')),
  hire_date date NOT NULL DEFAULT current_date,
  termination_date date,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  emergency_contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_id)
);
CREATE INDEX IF NOT EXISTS employee_records_tenant_idx ON employee_records(tenant_id);
ALTER TABLE employee_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_records_select" ON employee_records;
CREATE POLICY "employee_records_select" ON employee_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id));
DROP POLICY IF EXISTS "employee_records_insert" ON employee_records;
CREATE POLICY "employee_records_insert" ON employee_records FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id));
DROP POLICY IF EXISTS "employee_records_update" ON employee_records;
CREATE POLICY "employee_records_update" ON employee_records FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id));
DROP POLICY IF EXISTS "employee_records_delete" ON employee_records;
CREATE POLICY "employee_records_delete" ON employee_records FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id));

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'annual' CHECK (leave_type IN ('annual','sick','maternity','paternity','unpaid','other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leave_requests_tenant_idx ON leave_requests(tenant_id, start_date DESC);
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id));
DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id));
DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id));
DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;
CREATE POLICY "leave_requests_delete" ON leave_requests FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id));

-- ============================================================
-- 3. PAYROLL
-- ============================================================
CREATE TABLE IF NOT EXISTS payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_id, period_month)
);
CREATE INDEX IF NOT EXISTS payslips_tenant_idx ON payslips(tenant_id, period_month DESC);
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payslips_select" ON payslips;
CREATE POLICY "payslips_select" ON payslips FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id));
DROP POLICY IF EXISTS "payslips_insert" ON payslips;
CREATE POLICY "payslips_insert" ON payslips FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id));
DROP POLICY IF EXISTS "payslips_update" ON payslips;
CREATE POLICY "payslips_update" ON payslips FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id));
DROP POLICY IF EXISTS "payslips_delete" ON payslips;
CREATE POLICY "payslips_delete" ON payslips FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id));

-- ============================================================
-- 4. GENERAL INVENTORY (equipment/consumables, distinct from pharmacy stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'equipment' CHECK (category IN ('equipment','consumable','furniture','it','other')),
  sku text,
  quantity int NOT NULL DEFAULT 0,
  reorder_level int NOT NULL DEFAULT 5,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_items_tenant_idx ON inventory_items(tenant_id);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
CREATE POLICY "inventory_items_select" ON inventory_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id));
DROP POLICY IF EXISTS "inventory_items_insert" ON inventory_items;
CREATE POLICY "inventory_items_insert" ON inventory_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id));
DROP POLICY IF EXISTS "inventory_items_update" ON inventory_items;
CREATE POLICY "inventory_items_update" ON inventory_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id));
DROP POLICY IF EXISTS "inventory_items_delete" ON inventory_items;
CREATE POLICY "inventory_items_delete" ON inventory_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id));

-- ============================================================
-- 5. INSURANCE / CLAIMS
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  provider_name text NOT NULL,
  policy_number text,
  claim_amount numeric(12,2) NOT NULL DEFAULT 0,
  approved_amount numeric(12,2),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','paid')),
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insurance_claims_tenant_idx ON insurance_claims(tenant_id, submitted_at DESC);
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insurance_claims_select" ON insurance_claims;
CREATE POLICY "insurance_claims_select" ON insurance_claims FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id));
DROP POLICY IF EXISTS "insurance_claims_insert" ON insurance_claims;
CREATE POLICY "insurance_claims_insert" ON insurance_claims FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id));
DROP POLICY IF EXISTS "insurance_claims_update" ON insurance_claims;
CREATE POLICY "insurance_claims_update" ON insurance_claims FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id));
DROP POLICY IF EXISTS "insurance_claims_delete" ON insurance_claims;
CREATE POLICY "insurance_claims_delete" ON insurance_claims FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id));

-- ============================================================
-- 6. TELEMEDICINE
-- ============================================================
CREATE TABLE IF NOT EXISTS telemedicine_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  video_link text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telemedicine_tenant_idx ON telemedicine_sessions(tenant_id, scheduled_at DESC);
ALTER TABLE telemedicine_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "telemedicine_select" ON telemedicine_sessions;
CREATE POLICY "telemedicine_select" ON telemedicine_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id));
DROP POLICY IF EXISTS "telemedicine_insert" ON telemedicine_sessions;
CREATE POLICY "telemedicine_insert" ON telemedicine_sessions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id));
DROP POLICY IF EXISTS "telemedicine_update" ON telemedicine_sessions;
CREATE POLICY "telemedicine_update" ON telemedicine_sessions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id));
DROP POLICY IF EXISTS "telemedicine_delete" ON telemedicine_sessions;
CREATE POLICY "telemedicine_delete" ON telemedicine_sessions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id));

-- ============================================================
-- 7. EMERGENCY / TRIAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  walk_in_name text,
  triage_level text NOT NULL DEFAULT 'urgent' CHECK (triage_level IN ('critical','urgent','standard','minor')),
  chief_complaint text NOT NULL,
  arrival_time timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_treatment','admitted','discharged','deceased','transferred')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (patient_id IS NOT NULL OR walk_in_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS emergency_cases_tenant_idx ON emergency_cases(tenant_id, arrival_time DESC);
ALTER TABLE emergency_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emergency_cases_select" ON emergency_cases;
CREATE POLICY "emergency_cases_select" ON emergency_cases FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id));
DROP POLICY IF EXISTS "emergency_cases_insert" ON emergency_cases;
CREATE POLICY "emergency_cases_insert" ON emergency_cases FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id));
DROP POLICY IF EXISTS "emergency_cases_update" ON emergency_cases;
CREATE POLICY "emergency_cases_update" ON emergency_cases FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id));
DROP POLICY IF EXISTS "emergency_cases_delete" ON emergency_cases;
CREATE POLICY "emergency_cases_delete" ON emergency_cases FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id));

-- ============================================================
-- 8. IMMUNIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS immunizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  dose_number int NOT NULL DEFAULT 1,
  date_administered date NOT NULL DEFAULT current_date,
  next_due_date date,
  administered_by uuid REFERENCES doctors(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS immunizations_tenant_idx ON immunizations(tenant_id, date_administered DESC);
ALTER TABLE immunizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "immunizations_select" ON immunizations;
CREATE POLICY "immunizations_select" ON immunizations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id));
DROP POLICY IF EXISTS "immunizations_insert" ON immunizations;
CREATE POLICY "immunizations_insert" ON immunizations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id));
DROP POLICY IF EXISTS "immunizations_update" ON immunizations;
CREATE POLICY "immunizations_update" ON immunizations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id));
DROP POLICY IF EXISTS "immunizations_delete" ON immunizations;
CREATE POLICY "immunizations_delete" ON immunizations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id));

-- ============================================================
-- 9. DISCHARGE SUMMARIES / REFERRAL LETTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS discharge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admission_id uuid REFERENCES admissions(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  summary text NOT NULL,
  follow_up_instructions text,
  referral_to text,
  discharged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discharge_summaries_tenant_idx ON discharge_summaries(tenant_id, discharged_at DESC);
ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discharge_summaries_select" ON discharge_summaries;
CREATE POLICY "discharge_summaries_select" ON discharge_summaries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id));
DROP POLICY IF EXISTS "discharge_summaries_insert" ON discharge_summaries;
CREATE POLICY "discharge_summaries_insert" ON discharge_summaries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id));
DROP POLICY IF EXISTS "discharge_summaries_update" ON discharge_summaries;
CREATE POLICY "discharge_summaries_update" ON discharge_summaries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id));
DROP POLICY IF EXISTS "discharge_summaries_delete" ON discharge_summaries;
CREATE POLICY "discharge_summaries_delete" ON discharge_summaries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id));

-- ============================================================
-- 10. REAL PLAN-BASED MODULE GATING
-- ============================================================
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS module_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE subscription_plans SET module_flags = '{
  "patients": true, "appointments": true, "doctors": true, "invoices": true, "reports": true,
  "records": false, "consultations": false, "prescriptions": false, "lab": false, "pharmacy": false,
  "radiology": false, "beds": false, "admissions": false, "surgeries": false, "inventory": false,
  "hr": false, "payroll": false, "staff": false, "roles": false,
  "performance": false, "telemedicine": false, "insurance": false, "emergency": false,
  "immunizations": false, "discharge": false, "marketplace": false
}'::jsonb WHERE code = 'starter';

UPDATE subscription_plans SET module_flags = '{
  "patients": true, "appointments": true, "doctors": true, "invoices": true, "reports": true,
  "records": true, "consultations": true, "prescriptions": true, "lab": true, "pharmacy": true,
  "radiology": false, "beds": false, "admissions": false, "surgeries": false, "inventory": false,
  "hr": false, "payroll": false, "staff": false, "roles": false,
  "performance": false, "telemedicine": false, "insurance": false, "emergency": false,
  "immunizations": false, "discharge": false, "marketplace": false
}'::jsonb WHERE code = 'professional';

UPDATE subscription_plans SET module_flags = '{
  "patients": true, "appointments": true, "doctors": true, "invoices": true, "reports": true,
  "records": true, "consultations": true, "prescriptions": true, "lab": true, "pharmacy": true,
  "radiology": true, "beds": true, "admissions": true, "surgeries": true, "inventory": true,
  "hr": true, "payroll": true, "staff": true, "roles": true,
  "performance": false, "telemedicine": false, "insurance": false, "emergency": false,
  "immunizations": false, "discharge": false, "marketplace": false
}'::jsonb WHERE code = 'business';

UPDATE subscription_plans SET module_flags = '{
  "patients": true, "appointments": true, "doctors": true, "invoices": true, "reports": true,
  "records": true, "consultations": true, "prescriptions": true, "lab": true, "pharmacy": true,
  "radiology": true, "beds": true, "admissions": true, "surgeries": true, "inventory": true,
  "hr": true, "payroll": true, "staff": true, "roles": true,
  "performance": true, "telemedicine": true, "insurance": true, "emergency": true,
  "immunizations": true, "discharge": true, "marketplace": true
}'::jsonb WHERE code = 'enterprise';

-- ============================================================
-- 11. REAL PLAN LIMIT ENFORCEMENT (max_users / max_doctors / max_patients)
-- A limit of 0 (or NULL) means unlimited, matching the existing seed data
-- convention where the Enterprise plan uses 0 for "unlimited".
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_max_users()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int; v_count int; BEGIN
  SELECT sp.max_users INTO v_max FROM tenants t LEFT JOIN subscription_plans sp ON sp.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count FROM tenant_memberships WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: max_users (%) reached for this plan', v_max;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enforce_max_users ON tenant_memberships;
CREATE TRIGGER trg_enforce_max_users BEFORE INSERT ON tenant_memberships FOR EACH ROW EXECUTE FUNCTION enforce_max_users();

CREATE OR REPLACE FUNCTION enforce_max_doctors()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int; v_count int; BEGIN
  SELECT sp.max_doctors INTO v_max FROM tenants t LEFT JOIN subscription_plans sp ON sp.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count FROM doctors WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: max_doctors (%) reached for this plan', v_max;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enforce_max_doctors ON doctors;
CREATE TRIGGER trg_enforce_max_doctors BEFORE INSERT ON doctors FOR EACH ROW EXECUTE FUNCTION enforce_max_doctors();

CREATE OR REPLACE FUNCTION enforce_max_patients()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int; v_count int; BEGIN
  SELECT sp.max_patients INTO v_max FROM tenants t LEFT JOIN subscription_plans sp ON sp.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count FROM patients WHERE tenant_id = NEW.tenant_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded: max_patients (%) reached for this plan', v_max;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enforce_max_patients ON patients;
CREATE TRIGGER trg_enforce_max_patients BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION enforce_max_patients();
