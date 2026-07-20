/*
# Health Cloud — Clinical & Operations Schema (v2)

## Purpose
Extend the multi-tenant foundation with the core clinical and operational
modules. Every table is tenant-scoped and RLS-isolated via tenant_memberships.

## New Tables (all tenant-scoped)
1. doctors — staff doctors per tenant
2. appointments — patient appointments
3. medical_records — patient medical records / encounters
4. consultations — consultation notes (SOAP)
5. prescriptions — medication prescriptions
6. lab_orders — laboratory test orders + results
7. radiology_orders — imaging orders + reports
8. pharmacy_items — pharmacy inventory (drug catalog per tenant)
9. beds — hospital beds + occupancy
10. admissions — hospitalization admissions (ADT)
11. invoices — billing invoices + line items
12. roles — tenant-custom RBAC roles
13. staff — staff directory (non-doctor)
14. notifications — in-app notifications

## Security
- RLS on every table, scoped via EXISTS check on tenant_memberships.
- All owner columns default to auth.uid() where applicable.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE).

## Important Notes
1. All tables carry tenant_id NOT NULL FK to tenants with ON DELETE CASCADE.
2. Indexes on tenant_id for every table.
3. Status enums use CHECK constraints.
4. No destructive changes to v1 tables.
*/

-- ---------- doctors ----------
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  specialty text,
  email text,
  phone text,
  license_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctors_tenant_idx ON doctors(tenant_id);
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doctors_select" ON doctors;
CREATE POLICY "doctors_select" ON doctors FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id));
DROP POLICY IF EXISTS "doctors_insert" ON doctors;
CREATE POLICY "doctors_insert" ON doctors FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id));
DROP POLICY IF EXISTS "doctors_update" ON doctors;
CREATE POLICY "doctors_update" ON doctors FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id));
DROP POLICY IF EXISTS "doctors_delete" ON doctors;
CREATE POLICY "doctors_delete" ON doctors FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id));

-- ---------- appointments ----------
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  reason text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appts_tenant_idx ON appointments(tenant_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS appts_patient_idx ON appointments(patient_id);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appts_select" ON appointments;
CREATE POLICY "appts_select" ON appointments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id));
DROP POLICY IF EXISTS "appts_insert" ON appointments;
CREATE POLICY "appts_insert" ON appointments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id));
DROP POLICY IF EXISTS "appts_update" ON appointments;
CREATE POLICY "appts_update" ON appointments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id));
DROP POLICY IF EXISTS "appts_delete" ON appointments;
CREATE POLICY "appts_delete" ON appointments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id));

-- ---------- medical_records ----------
CREATE TABLE IF NOT EXISTS medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  record_date timestamptz NOT NULL DEFAULT now(),
  chief_complaint text,
  history text,
  examination text,
  diagnosis text,
  icd10_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mr_tenant_idx ON medical_records(tenant_id, record_date DESC);
CREATE INDEX IF NOT EXISTS mr_patient_idx ON medical_records(patient_id);
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mr_select" ON medical_records;
CREATE POLICY "mr_select" ON medical_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id));
DROP POLICY IF EXISTS "mr_insert" ON medical_records;
CREATE POLICY "mr_insert" ON medical_records FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id));
DROP POLICY IF EXISTS "mr_update" ON medical_records;
CREATE POLICY "mr_update" ON medical_records FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id));
DROP POLICY IF EXISTS "mr_delete" ON medical_records;
CREATE POLICY "mr_delete" ON medical_records FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id));

-- ---------- consultations ----------
CREATE TABLE IF NOT EXISTS consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  consult_date timestamptz NOT NULL DEFAULT now(),
  subjective text,
  objective text,
  assessment text,
  plan text,
  follow_up date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cons_tenant_idx ON consultations(tenant_id, consult_date DESC);
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cons_select" ON consultations;
CREATE POLICY "cons_select" ON consultations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id));
DROP POLICY IF EXISTS "cons_insert" ON consultations;
CREATE POLICY "cons_insert" ON consultations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id));
DROP POLICY IF EXISTS "cons_update" ON consultations;
CREATE POLICY "cons_update" ON consultations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id));
DROP POLICY IF EXISTS "cons_delete" ON consultations;
CREATE POLICY "cons_delete" ON consultations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id));

-- ---------- prescriptions ----------
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  medication text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','dispensed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rx_tenant_idx ON prescriptions(tenant_id, created_at DESC);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rx_select" ON prescriptions;
CREATE POLICY "rx_select" ON prescriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id));
DROP POLICY IF EXISTS "rx_insert" ON prescriptions;
CREATE POLICY "rx_insert" ON prescriptions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id));
DROP POLICY IF EXISTS "rx_update" ON prescriptions;
CREATE POLICY "rx_update" ON prescriptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id));
DROP POLICY IF EXISTS "rx_delete" ON prescriptions;
CREATE POLICY "rx_delete" ON prescriptions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id));

-- ---------- lab_orders ----------
CREATE TABLE IF NOT EXISTS lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  test_name text NOT NULL,
  test_code text,
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','collected','resulted','validated','cancelled')),
  result text,
  reference_values text,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  resulted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_tenant_idx ON lab_orders(tenant_id, ordered_at DESC);
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lab_select" ON lab_orders;
CREATE POLICY "lab_select" ON lab_orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id));
DROP POLICY IF EXISTS "lab_insert" ON lab_orders;
CREATE POLICY "lab_insert" ON lab_orders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id));
DROP POLICY IF EXISTS "lab_update" ON lab_orders;
CREATE POLICY "lab_update" ON lab_orders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id));
DROP POLICY IF EXISTS "lab_delete" ON lab_orders;
CREATE POLICY "lab_delete" ON lab_orders FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id));

-- ---------- radiology_orders ----------
CREATE TABLE IF NOT EXISTS radiology_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  modality text NOT NULL,
  body_part text NOT NULL,
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','performed','reported','validated','cancelled')),
  report text,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rad_tenant_idx ON radiology_orders(tenant_id, ordered_at DESC);
ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rad_select" ON radiology_orders;
CREATE POLICY "rad_select" ON radiology_orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id));
DROP POLICY IF EXISTS "rad_insert" ON radiology_orders;
CREATE POLICY "rad_insert" ON radiology_orders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id));
DROP POLICY IF EXISTS "rad_update" ON radiology_orders;
CREATE POLICY "rad_update" ON radiology_orders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id));
DROP POLICY IF EXISTS "rad_delete" ON radiology_orders;
CREATE POLICY "rad_delete" ON radiology_orders FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id));

-- ---------- pharmacy_items ----------
CREATE TABLE IF NOT EXISTS pharmacy_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  generic_name text,
  form text,
  strength text,
  batch_number text,
  expiry_date date,
  quantity int NOT NULL DEFAULT 0,
  reorder_level int NOT NULL DEFAULT 10,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pharm_tenant_idx ON pharmacy_items(tenant_id);
ALTER TABLE pharmacy_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pharm_select" ON pharmacy_items;
CREATE POLICY "pharm_select" ON pharmacy_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id));
DROP POLICY IF EXISTS "pharm_insert" ON pharmacy_items;
CREATE POLICY "pharm_insert" ON pharmacy_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id));
DROP POLICY IF EXISTS "pharm_update" ON pharmacy_items;
CREATE POLICY "pharm_update" ON pharmacy_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id));
DROP POLICY IF EXISTS "pharm_delete" ON pharmacy_items;
CREATE POLICY "pharm_delete" ON pharmacy_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id));

-- ---------- beds ----------
CREATE TABLE IF NOT EXISTS beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ward text NOT NULL,
  room text NOT NULL,
  bed_number text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','cleaning','maintenance','reserved')),
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beds_tenant_idx ON beds(tenant_id, ward);
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "beds_select" ON beds;
CREATE POLICY "beds_select" ON beds FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id));
DROP POLICY IF EXISTS "beds_insert" ON beds;
CREATE POLICY "beds_insert" ON beds FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id));
DROP POLICY IF EXISTS "beds_update" ON beds;
CREATE POLICY "beds_update" ON beds FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id));
DROP POLICY IF EXISTS "beds_delete" ON beds;
CREATE POLICY "beds_delete" ON beds FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id));

-- ---------- admissions ----------
CREATE TABLE IF NOT EXISTS admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  bed_id uuid REFERENCES beds(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  admission_date timestamptz NOT NULL DEFAULT now(),
  discharge_date timestamptz,
  reason text,
  status text NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted','discharged','transferred')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adm_tenant_idx ON admissions(tenant_id, admission_date DESC);
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adm_select" ON admissions;
CREATE POLICY "adm_select" ON admissions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id));
DROP POLICY IF EXISTS "adm_insert" ON admissions;
CREATE POLICY "adm_insert" ON admissions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id));
DROP POLICY IF EXISTS "adm_update" ON admissions;
CREATE POLICY "adm_update" ON admissions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id));
DROP POLICY IF EXISTS "adm_delete" ON admissions;
CREATE POLICY "adm_delete" ON admissions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id));

-- ---------- invoices ----------
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  issue_date timestamptz NOT NULL DEFAULT now(),
  due_date date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','partial','cancelled','refunded')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS inv_tenant_idx ON invoices(tenant_id, issue_date DESC);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_select" ON invoices;
CREATE POLICY "inv_select" ON invoices FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id));
DROP POLICY IF EXISTS "inv_insert" ON invoices;
CREATE POLICY "inv_insert" ON invoices FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id));
DROP POLICY IF EXISTS "inv_update" ON invoices;
CREATE POLICY "inv_update" ON invoices FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id));
DROP POLICY IF EXISTS "inv_delete" ON invoices;
CREATE POLICY "inv_delete" ON invoices FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id));

-- ---------- roles (tenant RBAC) ----------
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS roles_tenant_idx ON roles(tenant_id);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id));
DROP POLICY IF EXISTS "roles_insert" ON roles;
CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id));
DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id));
DROP POLICY IF EXISTS "roles_delete" ON roles;
CREATE POLICY "roles_delete" ON roles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id));

-- ---------- staff ----------
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text,
  department text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_tenant_idx ON staff(tenant_id);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_select" ON staff;
CREATE POLICY "staff_select" ON staff FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id));
DROP POLICY IF EXISTS "staff_insert" ON staff;
CREATE POLICY "staff_insert" ON staff FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id));
DROP POLICY IF EXISTS "staff_update" ON staff;
CREATE POLICY "staff_update" ON staff FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id));
DROP POLICY IF EXISTS "staff_delete" ON staff;
CREATE POLICY "staff_delete" ON staff FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id));

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = notifications.tenant_id)));
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = notifications.tenant_id)));
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- super admin: tenant verification helpers ----------
-- Allow super admins to update any tenant (already covered by tenants_update_own policy)
