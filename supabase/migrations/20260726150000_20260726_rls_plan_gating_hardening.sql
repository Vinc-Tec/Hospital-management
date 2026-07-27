/*
# RLS-level enforcement of plan module gating (defense in depth)

## Why
Module access is already blocked at the application layer (ModuleGate +
filtered sidebar in the frontend). This migration duplicates that check
inside the RLS policies themselves, so that a tenant's own technically
sophisticated user cannot bypass the paywall by calling the Supabase API
directly instead of going through the UI.

This is NOT a cross-tenant isolation fix -- a tenant could already only
ever see its own rows. It closes a monetization/business-logic gap: every
tenant, regardless of what they paid for, could otherwise reach any
module's data for their own tenant via a raw API call.

Super admins bypass this check entirely (they must retain full access
regardless of any tenant's plan, consistent with the frontend ModuleGate).
*/

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


-- ---------- medical_records (module: records) ----------
DROP POLICY IF EXISTS "mr_select" ON medical_records;
CREATE POLICY "mr_select" ON medical_records FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id)
  AND tenant_module_enabled(medical_records.tenant_id, 'records')
);
DROP POLICY IF EXISTS "mr_insert" ON medical_records;
CREATE POLICY "mr_insert" ON medical_records FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id)
  AND tenant_module_enabled(medical_records.tenant_id, 'records')
);
DROP POLICY IF EXISTS "mr_update" ON medical_records;
CREATE POLICY "mr_update" ON medical_records FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id)
  AND tenant_module_enabled(medical_records.tenant_id, 'records')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id)
  AND tenant_module_enabled(medical_records.tenant_id, 'records')
);
DROP POLICY IF EXISTS "mr_delete" ON medical_records;
CREATE POLICY "mr_delete" ON medical_records FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = medical_records.tenant_id)
  AND tenant_module_enabled(medical_records.tenant_id, 'records')
);

-- ---------- consultations (module: consultations) ----------
DROP POLICY IF EXISTS "cons_select" ON consultations;
CREATE POLICY "cons_select" ON consultations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id)
  AND tenant_module_enabled(consultations.tenant_id, 'consultations')
);
DROP POLICY IF EXISTS "cons_insert" ON consultations;
CREATE POLICY "cons_insert" ON consultations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id)
  AND tenant_module_enabled(consultations.tenant_id, 'consultations')
);
DROP POLICY IF EXISTS "cons_update" ON consultations;
CREATE POLICY "cons_update" ON consultations FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id)
  AND tenant_module_enabled(consultations.tenant_id, 'consultations')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id)
  AND tenant_module_enabled(consultations.tenant_id, 'consultations')
);
DROP POLICY IF EXISTS "cons_delete" ON consultations;
CREATE POLICY "cons_delete" ON consultations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = consultations.tenant_id)
  AND tenant_module_enabled(consultations.tenant_id, 'consultations')
);

-- ---------- prescriptions (module: prescriptions) ----------
DROP POLICY IF EXISTS "rx_select" ON prescriptions;
CREATE POLICY "rx_select" ON prescriptions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id)
  AND tenant_module_enabled(prescriptions.tenant_id, 'prescriptions')
);
DROP POLICY IF EXISTS "rx_insert" ON prescriptions;
CREATE POLICY "rx_insert" ON prescriptions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id)
  AND tenant_module_enabled(prescriptions.tenant_id, 'prescriptions')
);
DROP POLICY IF EXISTS "rx_update" ON prescriptions;
CREATE POLICY "rx_update" ON prescriptions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id)
  AND tenant_module_enabled(prescriptions.tenant_id, 'prescriptions')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id)
  AND tenant_module_enabled(prescriptions.tenant_id, 'prescriptions')
);
DROP POLICY IF EXISTS "rx_delete" ON prescriptions;
CREATE POLICY "rx_delete" ON prescriptions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = prescriptions.tenant_id)
  AND tenant_module_enabled(prescriptions.tenant_id, 'prescriptions')
);

-- ---------- lab_orders (module: lab) ----------
DROP POLICY IF EXISTS "lab_select" ON lab_orders;
CREATE POLICY "lab_select" ON lab_orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id)
  AND tenant_module_enabled(lab_orders.tenant_id, 'lab')
);
DROP POLICY IF EXISTS "lab_insert" ON lab_orders;
CREATE POLICY "lab_insert" ON lab_orders FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id)
  AND tenant_module_enabled(lab_orders.tenant_id, 'lab')
);
DROP POLICY IF EXISTS "lab_update" ON lab_orders;
CREATE POLICY "lab_update" ON lab_orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id)
  AND tenant_module_enabled(lab_orders.tenant_id, 'lab')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id)
  AND tenant_module_enabled(lab_orders.tenant_id, 'lab')
);
DROP POLICY IF EXISTS "lab_delete" ON lab_orders;
CREATE POLICY "lab_delete" ON lab_orders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = lab_orders.tenant_id)
  AND tenant_module_enabled(lab_orders.tenant_id, 'lab')
);

-- ---------- radiology_orders (module: radiology) ----------
DROP POLICY IF EXISTS "rad_select" ON radiology_orders;
CREATE POLICY "rad_select" ON radiology_orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id)
  AND tenant_module_enabled(radiology_orders.tenant_id, 'radiology')
);
DROP POLICY IF EXISTS "rad_insert" ON radiology_orders;
CREATE POLICY "rad_insert" ON radiology_orders FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id)
  AND tenant_module_enabled(radiology_orders.tenant_id, 'radiology')
);
DROP POLICY IF EXISTS "rad_update" ON radiology_orders;
CREATE POLICY "rad_update" ON radiology_orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id)
  AND tenant_module_enabled(radiology_orders.tenant_id, 'radiology')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id)
  AND tenant_module_enabled(radiology_orders.tenant_id, 'radiology')
);
DROP POLICY IF EXISTS "rad_delete" ON radiology_orders;
CREATE POLICY "rad_delete" ON radiology_orders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = radiology_orders.tenant_id)
  AND tenant_module_enabled(radiology_orders.tenant_id, 'radiology')
);

-- ---------- pharmacy_items (module: pharmacy) ----------
DROP POLICY IF EXISTS "pharm_select" ON pharmacy_items;
CREATE POLICY "pharm_select" ON pharmacy_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id)
  AND tenant_module_enabled(pharmacy_items.tenant_id, 'pharmacy')
);
DROP POLICY IF EXISTS "pharm_insert" ON pharmacy_items;
CREATE POLICY "pharm_insert" ON pharmacy_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id)
  AND tenant_module_enabled(pharmacy_items.tenant_id, 'pharmacy')
);
DROP POLICY IF EXISTS "pharm_update" ON pharmacy_items;
CREATE POLICY "pharm_update" ON pharmacy_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id)
  AND tenant_module_enabled(pharmacy_items.tenant_id, 'pharmacy')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id)
  AND tenant_module_enabled(pharmacy_items.tenant_id, 'pharmacy')
);
DROP POLICY IF EXISTS "pharm_delete" ON pharmacy_items;
CREATE POLICY "pharm_delete" ON pharmacy_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = pharmacy_items.tenant_id)
  AND tenant_module_enabled(pharmacy_items.tenant_id, 'pharmacy')
);

-- ---------- beds (module: beds) ----------
DROP POLICY IF EXISTS "beds_select" ON beds;
CREATE POLICY "beds_select" ON beds FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id)
  AND tenant_module_enabled(beds.tenant_id, 'beds')
);
DROP POLICY IF EXISTS "beds_insert" ON beds;
CREATE POLICY "beds_insert" ON beds FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id)
  AND tenant_module_enabled(beds.tenant_id, 'beds')
);
DROP POLICY IF EXISTS "beds_update" ON beds;
CREATE POLICY "beds_update" ON beds FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id)
  AND tenant_module_enabled(beds.tenant_id, 'beds')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id)
  AND tenant_module_enabled(beds.tenant_id, 'beds')
);
DROP POLICY IF EXISTS "beds_delete" ON beds;
CREATE POLICY "beds_delete" ON beds FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = beds.tenant_id)
  AND tenant_module_enabled(beds.tenant_id, 'beds')
);

-- ---------- admissions (module: admissions) ----------
DROP POLICY IF EXISTS "adm_select" ON admissions;
CREATE POLICY "adm_select" ON admissions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id)
  AND tenant_module_enabled(admissions.tenant_id, 'admissions')
);
DROP POLICY IF EXISTS "adm_insert" ON admissions;
CREATE POLICY "adm_insert" ON admissions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id)
  AND tenant_module_enabled(admissions.tenant_id, 'admissions')
);
DROP POLICY IF EXISTS "adm_update" ON admissions;
CREATE POLICY "adm_update" ON admissions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id)
  AND tenant_module_enabled(admissions.tenant_id, 'admissions')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id)
  AND tenant_module_enabled(admissions.tenant_id, 'admissions')
);
DROP POLICY IF EXISTS "adm_delete" ON admissions;
CREATE POLICY "adm_delete" ON admissions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = admissions.tenant_id)
  AND tenant_module_enabled(admissions.tenant_id, 'admissions')
);

-- ---------- staff (module: staff) ----------
DROP POLICY IF EXISTS "staff_select" ON staff;
CREATE POLICY "staff_select" ON staff FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id)
  AND tenant_module_enabled(staff.tenant_id, 'staff')
);
DROP POLICY IF EXISTS "staff_insert" ON staff;
CREATE POLICY "staff_insert" ON staff FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id)
  AND tenant_module_enabled(staff.tenant_id, 'staff')
);
DROP POLICY IF EXISTS "staff_update" ON staff;
CREATE POLICY "staff_update" ON staff FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id)
  AND tenant_module_enabled(staff.tenant_id, 'staff')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id)
  AND tenant_module_enabled(staff.tenant_id, 'staff')
);
DROP POLICY IF EXISTS "staff_delete" ON staff;
CREATE POLICY "staff_delete" ON staff FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = staff.tenant_id)
  AND tenant_module_enabled(staff.tenant_id, 'staff')
);

-- ---------- roles (module: roles) ----------
DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id)
  AND tenant_module_enabled(roles.tenant_id, 'roles')
);
DROP POLICY IF EXISTS "roles_insert" ON roles;
CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id)
  AND tenant_module_enabled(roles.tenant_id, 'roles')
);
DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id)
  AND tenant_module_enabled(roles.tenant_id, 'roles')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id)
  AND tenant_module_enabled(roles.tenant_id, 'roles')
);
DROP POLICY IF EXISTS "roles_delete" ON roles;
CREATE POLICY "roles_delete" ON roles FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = roles.tenant_id)
  AND tenant_module_enabled(roles.tenant_id, 'roles')
);

-- ---------- surgeries (module: surgeries) ----------
DROP POLICY IF EXISTS "surgeries_select" ON surgeries;
CREATE POLICY "surgeries_select" ON surgeries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id)
  AND tenant_module_enabled(surgeries.tenant_id, 'surgeries')
);
DROP POLICY IF EXISTS "surgeries_insert" ON surgeries;
CREATE POLICY "surgeries_insert" ON surgeries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id)
  AND tenant_module_enabled(surgeries.tenant_id, 'surgeries')
);
DROP POLICY IF EXISTS "surgeries_update" ON surgeries;
CREATE POLICY "surgeries_update" ON surgeries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id)
  AND tenant_module_enabled(surgeries.tenant_id, 'surgeries')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id)
  AND tenant_module_enabled(surgeries.tenant_id, 'surgeries')
);
DROP POLICY IF EXISTS "surgeries_delete" ON surgeries;
CREATE POLICY "surgeries_delete" ON surgeries FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = surgeries.tenant_id)
  AND tenant_module_enabled(surgeries.tenant_id, 'surgeries')
);

-- ---------- employee_records (module: hr) ----------
DROP POLICY IF EXISTS "employee_records_select" ON employee_records;
CREATE POLICY "employee_records_select" ON employee_records FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id)
  AND tenant_module_enabled(employee_records.tenant_id, 'hr')
);
DROP POLICY IF EXISTS "employee_records_insert" ON employee_records;
CREATE POLICY "employee_records_insert" ON employee_records FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id)
  AND tenant_module_enabled(employee_records.tenant_id, 'hr')
);
DROP POLICY IF EXISTS "employee_records_update" ON employee_records;
CREATE POLICY "employee_records_update" ON employee_records FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id)
  AND tenant_module_enabled(employee_records.tenant_id, 'hr')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id)
  AND tenant_module_enabled(employee_records.tenant_id, 'hr')
);
DROP POLICY IF EXISTS "employee_records_delete" ON employee_records;
CREATE POLICY "employee_records_delete" ON employee_records FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = employee_records.tenant_id)
  AND tenant_module_enabled(employee_records.tenant_id, 'hr')
);

-- ---------- leave_requests (module: hr) ----------
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id)
  AND tenant_module_enabled(leave_requests.tenant_id, 'hr')
);
DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id)
  AND tenant_module_enabled(leave_requests.tenant_id, 'hr')
);
DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id)
  AND tenant_module_enabled(leave_requests.tenant_id, 'hr')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id)
  AND tenant_module_enabled(leave_requests.tenant_id, 'hr')
);
DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;
CREATE POLICY "leave_requests_delete" ON leave_requests FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = leave_requests.tenant_id)
  AND tenant_module_enabled(leave_requests.tenant_id, 'hr')
);

-- ---------- payslips (module: payroll) ----------
DROP POLICY IF EXISTS "payslips_select" ON payslips;
CREATE POLICY "payslips_select" ON payslips FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id)
  AND tenant_module_enabled(payslips.tenant_id, 'payroll')
);
DROP POLICY IF EXISTS "payslips_insert" ON payslips;
CREATE POLICY "payslips_insert" ON payslips FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id)
  AND tenant_module_enabled(payslips.tenant_id, 'payroll')
);
DROP POLICY IF EXISTS "payslips_update" ON payslips;
CREATE POLICY "payslips_update" ON payslips FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id)
  AND tenant_module_enabled(payslips.tenant_id, 'payroll')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id)
  AND tenant_module_enabled(payslips.tenant_id, 'payroll')
);
DROP POLICY IF EXISTS "payslips_delete" ON payslips;
CREATE POLICY "payslips_delete" ON payslips FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = payslips.tenant_id)
  AND tenant_module_enabled(payslips.tenant_id, 'payroll')
);

-- ---------- inventory_items (module: inventory) ----------
DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
CREATE POLICY "inventory_items_select" ON inventory_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id)
  AND tenant_module_enabled(inventory_items.tenant_id, 'inventory')
);
DROP POLICY IF EXISTS "inventory_items_insert" ON inventory_items;
CREATE POLICY "inventory_items_insert" ON inventory_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id)
  AND tenant_module_enabled(inventory_items.tenant_id, 'inventory')
);
DROP POLICY IF EXISTS "inventory_items_update" ON inventory_items;
CREATE POLICY "inventory_items_update" ON inventory_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id)
  AND tenant_module_enabled(inventory_items.tenant_id, 'inventory')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id)
  AND tenant_module_enabled(inventory_items.tenant_id, 'inventory')
);
DROP POLICY IF EXISTS "inventory_items_delete" ON inventory_items;
CREATE POLICY "inventory_items_delete" ON inventory_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = inventory_items.tenant_id)
  AND tenant_module_enabled(inventory_items.tenant_id, 'inventory')
);

-- ---------- insurance_claims (module: insurance) ----------
DROP POLICY IF EXISTS "insurance_claims_select" ON insurance_claims;
CREATE POLICY "insurance_claims_select" ON insurance_claims FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id)
  AND tenant_module_enabled(insurance_claims.tenant_id, 'insurance')
);
DROP POLICY IF EXISTS "insurance_claims_insert" ON insurance_claims;
CREATE POLICY "insurance_claims_insert" ON insurance_claims FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id)
  AND tenant_module_enabled(insurance_claims.tenant_id, 'insurance')
);
DROP POLICY IF EXISTS "insurance_claims_update" ON insurance_claims;
CREATE POLICY "insurance_claims_update" ON insurance_claims FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id)
  AND tenant_module_enabled(insurance_claims.tenant_id, 'insurance')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id)
  AND tenant_module_enabled(insurance_claims.tenant_id, 'insurance')
);
DROP POLICY IF EXISTS "insurance_claims_delete" ON insurance_claims;
CREATE POLICY "insurance_claims_delete" ON insurance_claims FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = insurance_claims.tenant_id)
  AND tenant_module_enabled(insurance_claims.tenant_id, 'insurance')
);

-- ---------- telemedicine_sessions (module: telemedicine) ----------
DROP POLICY IF EXISTS "telemedicine_select" ON telemedicine_sessions;
CREATE POLICY "telemedicine_select" ON telemedicine_sessions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id)
  AND tenant_module_enabled(telemedicine_sessions.tenant_id, 'telemedicine')
);
DROP POLICY IF EXISTS "telemedicine_insert" ON telemedicine_sessions;
CREATE POLICY "telemedicine_insert" ON telemedicine_sessions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id)
  AND tenant_module_enabled(telemedicine_sessions.tenant_id, 'telemedicine')
);
DROP POLICY IF EXISTS "telemedicine_update" ON telemedicine_sessions;
CREATE POLICY "telemedicine_update" ON telemedicine_sessions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id)
  AND tenant_module_enabled(telemedicine_sessions.tenant_id, 'telemedicine')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id)
  AND tenant_module_enabled(telemedicine_sessions.tenant_id, 'telemedicine')
);
DROP POLICY IF EXISTS "telemedicine_delete" ON telemedicine_sessions;
CREATE POLICY "telemedicine_delete" ON telemedicine_sessions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = telemedicine_sessions.tenant_id)
  AND tenant_module_enabled(telemedicine_sessions.tenant_id, 'telemedicine')
);

-- ---------- emergency_cases (module: emergency) ----------
DROP POLICY IF EXISTS "emergency_cases_select" ON emergency_cases;
CREATE POLICY "emergency_cases_select" ON emergency_cases FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id)
  AND tenant_module_enabled(emergency_cases.tenant_id, 'emergency')
);
DROP POLICY IF EXISTS "emergency_cases_insert" ON emergency_cases;
CREATE POLICY "emergency_cases_insert" ON emergency_cases FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id)
  AND tenant_module_enabled(emergency_cases.tenant_id, 'emergency')
);
DROP POLICY IF EXISTS "emergency_cases_update" ON emergency_cases;
CREATE POLICY "emergency_cases_update" ON emergency_cases FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id)
  AND tenant_module_enabled(emergency_cases.tenant_id, 'emergency')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id)
  AND tenant_module_enabled(emergency_cases.tenant_id, 'emergency')
);
DROP POLICY IF EXISTS "emergency_cases_delete" ON emergency_cases;
CREATE POLICY "emergency_cases_delete" ON emergency_cases FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = emergency_cases.tenant_id)
  AND tenant_module_enabled(emergency_cases.tenant_id, 'emergency')
);

-- ---------- immunizations (module: immunizations) ----------
DROP POLICY IF EXISTS "immunizations_select" ON immunizations;
CREATE POLICY "immunizations_select" ON immunizations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id)
  AND tenant_module_enabled(immunizations.tenant_id, 'immunizations')
);
DROP POLICY IF EXISTS "immunizations_insert" ON immunizations;
CREATE POLICY "immunizations_insert" ON immunizations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id)
  AND tenant_module_enabled(immunizations.tenant_id, 'immunizations')
);
DROP POLICY IF EXISTS "immunizations_update" ON immunizations;
CREATE POLICY "immunizations_update" ON immunizations FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id)
  AND tenant_module_enabled(immunizations.tenant_id, 'immunizations')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id)
  AND tenant_module_enabled(immunizations.tenant_id, 'immunizations')
);
DROP POLICY IF EXISTS "immunizations_delete" ON immunizations;
CREATE POLICY "immunizations_delete" ON immunizations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = immunizations.tenant_id)
  AND tenant_module_enabled(immunizations.tenant_id, 'immunizations')
);

-- ---------- discharge_summaries (module: discharge) ----------
DROP POLICY IF EXISTS "discharge_summaries_select" ON discharge_summaries;
CREATE POLICY "discharge_summaries_select" ON discharge_summaries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id)
  AND tenant_module_enabled(discharge_summaries.tenant_id, 'discharge')
);
DROP POLICY IF EXISTS "discharge_summaries_insert" ON discharge_summaries;
CREATE POLICY "discharge_summaries_insert" ON discharge_summaries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id)
  AND tenant_module_enabled(discharge_summaries.tenant_id, 'discharge')
);
DROP POLICY IF EXISTS "discharge_summaries_update" ON discharge_summaries;
CREATE POLICY "discharge_summaries_update" ON discharge_summaries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id)
  AND tenant_module_enabled(discharge_summaries.tenant_id, 'discharge')
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id)
  AND tenant_module_enabled(discharge_summaries.tenant_id, 'discharge')
);
DROP POLICY IF EXISTS "discharge_summaries_delete" ON discharge_summaries;
CREATE POLICY "discharge_summaries_delete" ON discharge_summaries FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = discharge_summaries.tenant_id)
  AND tenant_module_enabled(discharge_summaries.tenant_id, 'discharge')
);

-- ---------- get_staff_performance RPC (module: performance) ----------
CREATE OR REPLACE FUNCTION get_staff_performance(p_tenant_id uuid)
RETURNS TABLE (
  doctor_id uuid, first_name text, last_name text, specialty text, status text,
  appointments_count bigint, consultations_count bigint, prescriptions_count bigint,
  lab_orders_count bigint, radiology_orders_count bigint
) AS $$
BEGIN
  IF NOT (is_tenant_member(p_tenant_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: not a member of this tenant';
  END IF;
  IF NOT tenant_module_enabled(p_tenant_id, 'performance') THEN
    RAISE EXCEPTION 'forbidden: performance module not included in this tenant''s plan';
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.first_name, d.last_name, d.specialty, d.status,
    COALESCE(apt.cnt, 0), COALESCE(con.cnt, 0), COALESCE(pre.cnt, 0), COALESCE(lab.cnt, 0), COALESCE(rad.cnt, 0)
  FROM doctors d
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM appointments WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) apt ON apt.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM consultations WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) con ON con.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM prescriptions WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) pre ON pre.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM lab_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) lab ON lab.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM radiology_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) rad ON rad.doctor_id = d.id
  WHERE d.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
