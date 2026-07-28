/*
# Correction: billing enforcement should never permanently lock a tenant
# out of reading its own data

## Why
The previous migration (20260728090000) added tenant_billing_active() to
SELECT policies too. That means once a tenant's trial and grace period
fully lapse without a plan, they could no longer even read their own
patients, appointments, or invoices -- which would make the "export your
data" button on the grace-period screen useless right when a tenant needs
it most, and is not a defensible thing to do with health data: a clinic
should always be able to see and export its own records, even if it stops
paying. What should be blocked is creating NEW value (new patients, new
appointments, etc.) without an active plan -- not permanently locking
away historical data.

## Fix
1. Revert tenant_module_enabled() to its original, billing-agnostic form
   (module-tier check only). This automatically restores SELECT/DELETE
   access on the 20 previously plan-gated tables.
2. Revert SELECT and DELETE policies on the 4 core tables (patients,
   doctors, appointments, invoices) to their pre-billing-check form.
3. Add a single BEFORE INSERT OR UPDATE trigger, applied to all 24
   tenant-scoped clinical/business tables, that enforces
   tenant_billing_active() only for writes. Reading and deleting your own
   data remains available indefinitely as long as tenant_memberships
   still grants access; only creating or modifying records requires an
   active trial/grace period/paid plan.
*/

-- ---------- 1. revert tenant_module_enabled to billing-agnostic ----------
CREATE OR REPLACE FUNCTION tenant_module_enabled(p_tenant_id uuid, p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR COALESCE(
      (SELECT (sp.module_flags ->> p_module)::boolean
       FROM tenants t
       JOIN subscription_plans sp ON sp.id = t.plan_id
       WHERE t.id = p_tenant_id),
      false
    );
$$;

-- ---------- 2. revert SELECT/DELETE on the 4 core tables ----------
DROP POLICY IF EXISTS "patients_select" ON patients;
CREATE POLICY "patients_select" ON patients FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
);
DROP POLICY IF EXISTS "patients_delete" ON patients;
CREATE POLICY "patients_delete" ON patients FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
);

DROP POLICY IF EXISTS "doctors_select" ON doctors;
CREATE POLICY "doctors_select" ON doctors FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
);
DROP POLICY IF EXISTS "doctors_delete" ON doctors;
CREATE POLICY "doctors_delete" ON doctors FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
);

DROP POLICY IF EXISTS "appts_select" ON appointments;
CREATE POLICY "appts_select" ON appointments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
);
DROP POLICY IF EXISTS "appts_delete" ON appointments;
CREATE POLICY "appts_delete" ON appointments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
);

DROP POLICY IF EXISTS "inv_select" ON invoices;
CREATE POLICY "inv_select" ON invoices FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
);
DROP POLICY IF EXISTS "inv_delete" ON invoices;
CREATE POLICY "inv_delete" ON invoices FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
);

-- ---------- 3. enforce billing status on writes only, via trigger ----------
CREATE OR REPLACE FUNCTION enforce_tenant_billing_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT tenant_billing_active(NEW.tenant_id) THEN
    RAISE EXCEPTION 'subscription_inactive: this institution''s trial/subscription has expired. New records cannot be created or modified until a plan is active. Existing data remains readable and exportable.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'patients', 'doctors', 'appointments', 'invoices',
    'medical_records', 'consultations', 'prescriptions', 'lab_orders', 'radiology_orders',
    'pharmacy_items', 'beds', 'admissions', 'staff', 'roles', 'surgeries',
    'employee_records', 'leave_requests', 'payslips', 'inventory_items', 'insurance_claims',
    'telemedicine_sessions', 'emergency_cases', 'immunizations', 'discharge_summaries'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_billing_active ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_billing_active BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_tenant_billing_active()',
      tbl
    );
  END LOOP;
END $$;
