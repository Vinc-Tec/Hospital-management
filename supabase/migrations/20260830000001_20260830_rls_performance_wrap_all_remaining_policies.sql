/*
# RLS performance: wrap remaining inline auth.uid() calls

Follow-up to 20260830000000: the shared-function fix there only covered
policies that call is_tenant_member/is_super_admin/etc. The advisor
still flagged 139 policies because most clinical-table policies use an
inline EXISTS (... WHERE tm.user_id = auth.uid() ...) subquery directly
rather than calling the shared function. This migration rewrites every
one of those (auto-generated from the live policy definitions, logic
unchanged, only auth.uid() -> (select auth.uid())).

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

-- Auto-generated: rewrite auth.uid() -> (select auth.uid()) in every
-- remaining flagged RLS policy (inline usages not covered by the earlier
-- shared-function fix). Logic is unchanged; only the query plan differs.

DROP POLICY IF EXISTS "adm_delete" ON admissions;
CREATE POLICY "adm_delete" ON admissions FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = admissions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'admissions'::text)));

DROP POLICY IF EXISTS "adm_insert" ON admissions;
CREATE POLICY "adm_insert" ON admissions FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = admissions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'admissions'::text)));

DROP POLICY IF EXISTS "adm_select" ON admissions;
CREATE POLICY "adm_select" ON admissions FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = admissions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'admissions'::text)));

DROP POLICY IF EXISTS "adm_update" ON admissions;
CREATE POLICY "adm_update" ON admissions FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = admissions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'admissions'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = admissions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'admissions'::text)));

DROP POLICY IF EXISTS "ak_tenant_delete" ON api_keys;
CREATE POLICY "ak_tenant_delete" ON api_keys FOR DELETE TO authenticated
  USING ((is_super_admin() OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = api_keys.tenant_id)))))));

DROP POLICY IF EXISTS "ak_tenant_insert" ON api_keys;
CREATE POLICY "ak_tenant_insert" ON api_keys FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = api_keys.tenant_id)))) AND tenant_module_enabled(tenant_id, 'api'::text))));

DROP POLICY IF EXISTS "ak_sa_insert" ON api_keys;
CREATE POLICY "ak_sa_insert" ON api_keys FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "ak_sa_select" ON api_keys;
CREATE POLICY "ak_sa_select" ON api_keys FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "ak_tenant_select" ON api_keys;
CREATE POLICY "ak_tenant_select" ON api_keys FOR SELECT TO authenticated
  USING ((is_super_admin() OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = api_keys.tenant_id)))) AND tenant_module_enabled(tenant_id, 'api'::text))));

DROP POLICY IF EXISTS "ak_tenant_update" ON api_keys;
CREATE POLICY "ak_tenant_update" ON api_keys FOR UPDATE TO authenticated
  USING ((is_super_admin() OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = api_keys.tenant_id)))))))
  WITH CHECK ((is_super_admin() OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = api_keys.tenant_id)))))));

DROP POLICY IF EXISTS "ak_sa_update" ON api_keys;
CREATE POLICY "ak_sa_update" ON api_keys FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "appts_delete" ON appointments;
CREATE POLICY "appts_delete" ON appointments FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = appointments.tenant_id)))));

DROP POLICY IF EXISTS "appts_insert" ON appointments;
CREATE POLICY "appts_insert" ON appointments FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = appointments.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "appts_select" ON appointments;
CREATE POLICY "appts_select" ON appointments FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = appointments.tenant_id)))));

DROP POLICY IF EXISTS "appts_update" ON appointments;
CREATE POLICY "appts_update" ON appointments FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = appointments.tenant_id)))) AND tenant_billing_active(tenant_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = appointments.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR ((actor_user_id = (select auth.uid())) AND ((tenant_id IS NULL) OR is_tenant_member(tenant_id)))));

DROP POLICY IF EXISTS "beds_delete" ON beds;
CREATE POLICY "beds_delete" ON beds FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = beds.tenant_id)))) AND tenant_module_enabled(tenant_id, 'beds'::text)));

DROP POLICY IF EXISTS "beds_insert" ON beds;
CREATE POLICY "beds_insert" ON beds FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = beds.tenant_id)))) AND tenant_module_enabled(tenant_id, 'beds'::text)));

DROP POLICY IF EXISTS "beds_select" ON beds;
CREATE POLICY "beds_select" ON beds FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = beds.tenant_id)))) AND tenant_module_enabled(tenant_id, 'beds'::text)));

DROP POLICY IF EXISTS "beds_update" ON beds;
CREATE POLICY "beds_update" ON beds FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = beds.tenant_id)))) AND tenant_module_enabled(tenant_id, 'beds'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = beds.tenant_id)))) AND tenant_module_enabled(tenant_id, 'beds'::text)));

DROP POLICY IF EXISTS "cc_sa_insert" ON commercial_codes;
CREATE POLICY "cc_sa_insert" ON commercial_codes FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "cc_sa_select" ON commercial_codes;
CREATE POLICY "cc_sa_select" ON commercial_codes FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "cc_sa_update" ON commercial_codes;
CREATE POLICY "cc_sa_update" ON commercial_codes FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "cons_delete" ON consultations;
CREATE POLICY "cons_delete" ON consultations FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = consultations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'consultations'::text)));

DROP POLICY IF EXISTS "cons_insert" ON consultations;
CREATE POLICY "cons_insert" ON consultations FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = consultations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'consultations'::text)));

DROP POLICY IF EXISTS "cons_select" ON consultations;
CREATE POLICY "cons_select" ON consultations FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = consultations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'consultations'::text)));

DROP POLICY IF EXISTS "cons_update" ON consultations;
CREATE POLICY "cons_update" ON consultations FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = consultations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'consultations'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = consultations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'consultations'::text)));

DROP POLICY IF EXISTS "discharge_summaries_delete" ON discharge_summaries;
CREATE POLICY "discharge_summaries_delete" ON discharge_summaries FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = discharge_summaries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'discharge'::text)));

DROP POLICY IF EXISTS "discharge_summaries_insert" ON discharge_summaries;
CREATE POLICY "discharge_summaries_insert" ON discharge_summaries FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = discharge_summaries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'discharge'::text)));

DROP POLICY IF EXISTS "discharge_summaries_select" ON discharge_summaries;
CREATE POLICY "discharge_summaries_select" ON discharge_summaries FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = discharge_summaries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'discharge'::text)));

DROP POLICY IF EXISTS "discharge_summaries_update" ON discharge_summaries;
CREATE POLICY "discharge_summaries_update" ON discharge_summaries FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = discharge_summaries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'discharge'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = discharge_summaries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'discharge'::text)));

DROP POLICY IF EXISTS "doctors_delete" ON doctors;
CREATE POLICY "doctors_delete" ON doctors FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = doctors.tenant_id)))));

DROP POLICY IF EXISTS "doctors_insert" ON doctors;
CREATE POLICY "doctors_insert" ON doctors FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = doctors.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "doctors_select" ON doctors;
CREATE POLICY "doctors_select" ON doctors FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = doctors.tenant_id)))));

DROP POLICY IF EXISTS "doctors_update" ON doctors;
CREATE POLICY "doctors_update" ON doctors FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = doctors.tenant_id)))) AND tenant_billing_active(tenant_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = doctors.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "emergency_cases_delete" ON emergency_cases;
CREATE POLICY "emergency_cases_delete" ON emergency_cases FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = emergency_cases.tenant_id)))) AND tenant_module_enabled(tenant_id, 'emergency'::text)));

DROP POLICY IF EXISTS "emergency_cases_insert" ON emergency_cases;
CREATE POLICY "emergency_cases_insert" ON emergency_cases FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = emergency_cases.tenant_id)))) AND tenant_module_enabled(tenant_id, 'emergency'::text)));

DROP POLICY IF EXISTS "emergency_cases_select" ON emergency_cases;
CREATE POLICY "emergency_cases_select" ON emergency_cases FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = emergency_cases.tenant_id)))) AND tenant_module_enabled(tenant_id, 'emergency'::text)));

DROP POLICY IF EXISTS "emergency_cases_update" ON emergency_cases;
CREATE POLICY "emergency_cases_update" ON emergency_cases FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = emergency_cases.tenant_id)))) AND tenant_module_enabled(tenant_id, 'emergency'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = emergency_cases.tenant_id)))) AND tenant_module_enabled(tenant_id, 'emergency'::text)));

DROP POLICY IF EXISTS "employee_records_delete" ON employee_records;
CREATE POLICY "employee_records_delete" ON employee_records FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = employee_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "employee_records_insert" ON employee_records;
CREATE POLICY "employee_records_insert" ON employee_records FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = employee_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "employee_records_select" ON employee_records;
CREATE POLICY "employee_records_select" ON employee_records FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = employee_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "employee_records_update" ON employee_records;
CREATE POLICY "employee_records_update" ON employee_records FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = employee_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = employee_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "immunizations_delete" ON immunizations;
CREATE POLICY "immunizations_delete" ON immunizations FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = immunizations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'immunizations'::text)));

DROP POLICY IF EXISTS "immunizations_insert" ON immunizations;
CREATE POLICY "immunizations_insert" ON immunizations FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = immunizations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'immunizations'::text)));

DROP POLICY IF EXISTS "immunizations_select" ON immunizations;
CREATE POLICY "immunizations_select" ON immunizations FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = immunizations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'immunizations'::text)));

DROP POLICY IF EXISTS "immunizations_update" ON immunizations;
CREATE POLICY "immunizations_update" ON immunizations FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = immunizations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'immunizations'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = immunizations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'immunizations'::text)));

DROP POLICY IF EXISTS "insurance_claims_delete" ON insurance_claims;
CREATE POLICY "insurance_claims_delete" ON insurance_claims FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = insurance_claims.tenant_id)))) AND tenant_module_enabled(tenant_id, 'insurance'::text)));

DROP POLICY IF EXISTS "insurance_claims_insert" ON insurance_claims;
CREATE POLICY "insurance_claims_insert" ON insurance_claims FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = insurance_claims.tenant_id)))) AND tenant_module_enabled(tenant_id, 'insurance'::text)));

DROP POLICY IF EXISTS "insurance_claims_select" ON insurance_claims;
CREATE POLICY "insurance_claims_select" ON insurance_claims FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = insurance_claims.tenant_id)))) AND tenant_module_enabled(tenant_id, 'insurance'::text)));

DROP POLICY IF EXISTS "insurance_claims_update" ON insurance_claims;
CREATE POLICY "insurance_claims_update" ON insurance_claims FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = insurance_claims.tenant_id)))) AND tenant_module_enabled(tenant_id, 'insurance'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = insurance_claims.tenant_id)))) AND tenant_module_enabled(tenant_id, 'insurance'::text)));

DROP POLICY IF EXISTS "integrations_delete" ON integrations;
CREATE POLICY "integrations_delete" ON integrations FOR DELETE TO authenticated
  USING ((is_super_admin() OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = integrations.tenant_id))))));

DROP POLICY IF EXISTS "integrations_insert" ON integrations;
CREATE POLICY "integrations_insert" ON integrations FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = integrations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'integrations'::text))));

DROP POLICY IF EXISTS "integrations_select" ON integrations;
CREATE POLICY "integrations_select" ON integrations FOR SELECT TO authenticated
  USING ((is_super_admin() OR ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = integrations.tenant_id)))) AND tenant_module_enabled(tenant_id, 'integrations'::text))));

DROP POLICY IF EXISTS "integrations_update" ON integrations;
CREATE POLICY "integrations_update" ON integrations FOR UPDATE TO authenticated
  USING ((is_super_admin() OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = integrations.tenant_id))))))
  WITH CHECK ((is_super_admin() OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = integrations.tenant_id))))));

DROP POLICY IF EXISTS "inventory_items_delete" ON inventory_items;
CREATE POLICY "inventory_items_delete" ON inventory_items FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = inventory_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'inventory'::text)));

DROP POLICY IF EXISTS "inventory_items_insert" ON inventory_items;
CREATE POLICY "inventory_items_insert" ON inventory_items FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = inventory_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'inventory'::text)));

DROP POLICY IF EXISTS "inventory_items_select" ON inventory_items;
CREATE POLICY "inventory_items_select" ON inventory_items FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = inventory_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'inventory'::text)));

DROP POLICY IF EXISTS "inventory_items_update" ON inventory_items;
CREATE POLICY "inventory_items_update" ON inventory_items FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = inventory_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'inventory'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = inventory_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'inventory'::text)));

DROP POLICY IF EXISTS "inv_delete" ON invoices;
CREATE POLICY "inv_delete" ON invoices FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = invoices.tenant_id)))));

DROP POLICY IF EXISTS "inv_insert" ON invoices;
CREATE POLICY "inv_insert" ON invoices FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = invoices.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "inv_select" ON invoices;
CREATE POLICY "inv_select" ON invoices FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = invoices.tenant_id)))));

DROP POLICY IF EXISTS "inv_update" ON invoices;
CREATE POLICY "inv_update" ON invoices FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = invoices.tenant_id)))) AND tenant_billing_active(tenant_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = invoices.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "lab_delete" ON lab_orders;
CREATE POLICY "lab_delete" ON lab_orders FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = lab_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'lab'::text)));

DROP POLICY IF EXISTS "lab_insert" ON lab_orders;
CREATE POLICY "lab_insert" ON lab_orders FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = lab_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'lab'::text)));

DROP POLICY IF EXISTS "lab_select" ON lab_orders;
CREATE POLICY "lab_select" ON lab_orders FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = lab_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'lab'::text)));

DROP POLICY IF EXISTS "lab_update" ON lab_orders;
CREATE POLICY "lab_update" ON lab_orders FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = lab_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'lab'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = lab_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'lab'::text)));

DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;
CREATE POLICY "leave_requests_delete" ON leave_requests FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = leave_requests.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = leave_requests.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = leave_requests.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = leave_requests.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = leave_requests.tenant_id)))) AND tenant_module_enabled(tenant_id, 'hr'::text)));

DROP POLICY IF EXISTS "login_activity_insert_own" ON login_activity;
CREATE POLICY "login_activity_insert_own" ON login_activity FOR INSERT TO authenticated
  WITH CHECK (((user_id = (select auth.uid())) AND ((tenant_id IS NULL) OR is_tenant_member(tenant_id))));

DROP POLICY IF EXISTS "login_activity_tenant_select" ON login_activity;
CREATE POLICY "login_activity_tenant_select" ON login_activity FOR SELECT TO authenticated
  USING (((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = login_activity.tenant_id) AND (tm.role = 'admin'::text))))));

DROP POLICY IF EXISTS "login_activity_sa_select" ON login_activity;
CREATE POLICY "login_activity_sa_select" ON login_activity FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.is_super_admin = true)))));

DROP POLICY IF EXISTS "login_activity_update_own" ON login_activity;
CREATE POLICY "login_activity_update_own" ON login_activity FOR UPDATE TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "mr_delete" ON medical_records;
CREATE POLICY "mr_delete" ON medical_records FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = medical_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'records'::text)));

DROP POLICY IF EXISTS "mr_insert" ON medical_records;
CREATE POLICY "mr_insert" ON medical_records FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = medical_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'records'::text)));

DROP POLICY IF EXISTS "mr_select" ON medical_records;
CREATE POLICY "mr_select" ON medical_records FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = medical_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'records'::text)));

DROP POLICY IF EXISTS "mr_update" ON medical_records;
CREATE POLICY "mr_update" ON medical_records FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = medical_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'records'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = medical_records.tenant_id)))) AND tenant_module_enabled(tenant_id, 'records'::text)));

DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE TO authenticated
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (((user_id = (select auth.uid())) OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = notifications.tenant_id)))))));

DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated
  USING (((user_id = (select auth.uid())) OR ((tenant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = notifications.tenant_id)))))));

DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "patients_delete" ON patients;
CREATE POLICY "patients_delete" ON patients FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = patients.tenant_id)))));

DROP POLICY IF EXISTS "patients_insert" ON patients;
CREATE POLICY "patients_insert" ON patients FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = patients.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "patients_select" ON patients;
CREATE POLICY "patients_select" ON patients FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = patients.tenant_id)))));

DROP POLICY IF EXISTS "patients_update" ON patients;
CREATE POLICY "patients_update" ON patients FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = patients.tenant_id)))) AND tenant_billing_active(tenant_id)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = patients.tenant_id)))) AND tenant_billing_active(tenant_id)));

DROP POLICY IF EXISTS "payslips_delete" ON payslips;
CREATE POLICY "payslips_delete" ON payslips FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = payslips.tenant_id)))) AND tenant_module_enabled(tenant_id, 'payroll'::text)));

DROP POLICY IF EXISTS "payslips_insert" ON payslips;
CREATE POLICY "payslips_insert" ON payslips FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = payslips.tenant_id)))) AND tenant_module_enabled(tenant_id, 'payroll'::text)));

DROP POLICY IF EXISTS "payslips_select" ON payslips;
CREATE POLICY "payslips_select" ON payslips FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = payslips.tenant_id)))) AND tenant_module_enabled(tenant_id, 'payroll'::text)));

DROP POLICY IF EXISTS "payslips_update" ON payslips;
CREATE POLICY "payslips_update" ON payslips FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = payslips.tenant_id)))) AND tenant_module_enabled(tenant_id, 'payroll'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = payslips.tenant_id)))) AND tenant_module_enabled(tenant_id, 'payroll'::text)));

DROP POLICY IF EXISTS "pharm_delete" ON pharmacy_items;
CREATE POLICY "pharm_delete" ON pharmacy_items FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = pharmacy_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'pharmacy'::text)));

DROP POLICY IF EXISTS "pharm_insert" ON pharmacy_items;
CREATE POLICY "pharm_insert" ON pharmacy_items FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = pharmacy_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'pharmacy'::text)));

DROP POLICY IF EXISTS "pharm_select" ON pharmacy_items;
CREATE POLICY "pharm_select" ON pharmacy_items FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = pharmacy_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'pharmacy'::text)));

DROP POLICY IF EXISTS "pharm_update" ON pharmacy_items;
CREATE POLICY "pharm_update" ON pharmacy_items FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = pharmacy_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'pharmacy'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = pharmacy_items.tenant_id)))) AND tenant_module_enabled(tenant_id, 'pharmacy'::text)));

DROP POLICY IF EXISTS "pn_sa_insert" ON platform_notifications;
CREATE POLICY "pn_sa_insert" ON platform_notifications FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))));

DROP POLICY IF EXISTS "rx_delete" ON prescriptions;
CREATE POLICY "rx_delete" ON prescriptions FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = prescriptions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'prescriptions'::text)));

DROP POLICY IF EXISTS "rx_insert" ON prescriptions;
CREATE POLICY "rx_insert" ON prescriptions FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = prescriptions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'prescriptions'::text)));

DROP POLICY IF EXISTS "rx_select" ON prescriptions;
CREATE POLICY "rx_select" ON prescriptions FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = prescriptions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'prescriptions'::text)));

DROP POLICY IF EXISTS "rx_update" ON prescriptions;
CREATE POLICY "rx_update" ON prescriptions FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = prescriptions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'prescriptions'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = prescriptions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'prescriptions'::text)));

DROP POLICY IF EXISTS "profiles_self_insert" ON profiles;
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (((select auth.uid()) = id));

DROP POLICY IF EXISTS "profiles_self_select" ON profiles;
CREATE POLICY "profiles_self_select" ON profiles FOR SELECT TO authenticated
  USING (((select auth.uid()) = id));

DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE TO authenticated
  USING (((select auth.uid()) = id))
  WITH CHECK (((select auth.uid()) = id));

DROP POLICY IF EXISTS "rad_delete" ON radiology_orders;
CREATE POLICY "rad_delete" ON radiology_orders FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = radiology_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'radiology'::text)));

DROP POLICY IF EXISTS "rad_insert" ON radiology_orders;
CREATE POLICY "rad_insert" ON radiology_orders FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = radiology_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'radiology'::text)));

DROP POLICY IF EXISTS "rad_select" ON radiology_orders;
CREATE POLICY "rad_select" ON radiology_orders FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = radiology_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'radiology'::text)));

DROP POLICY IF EXISTS "rad_update" ON radiology_orders;
CREATE POLICY "rad_update" ON radiology_orders FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = radiology_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'radiology'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = radiology_orders.tenant_id)))) AND tenant_module_enabled(tenant_id, 'radiology'::text)));

DROP POLICY IF EXISTS "reports_delete_own" ON reports;
CREATE POLICY "reports_delete_own" ON reports FOR DELETE TO authenticated
  USING ((((select auth.uid()) = user_id) OR is_super_admin()));

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated
  WITH CHECK ((((select auth.uid()) = user_id) AND ((tenant_id IS NULL) OR is_tenant_member(tenant_id))));

DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated
  USING ((((select auth.uid()) = user_id) OR is_tenant_member(tenant_id) OR is_super_admin()));

DROP POLICY IF EXISTS "reports_update_own" ON reports;
CREATE POLICY "reports_update_own" ON reports FOR UPDATE TO authenticated
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "roles_delete" ON roles;
CREATE POLICY "roles_delete" ON roles FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = roles.tenant_id)))) AND tenant_module_enabled(tenant_id, 'roles'::text)));

DROP POLICY IF EXISTS "roles_insert" ON roles;
CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = roles.tenant_id)))) AND tenant_module_enabled(tenant_id, 'roles'::text)));

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = roles.tenant_id)))) AND tenant_module_enabled(tenant_id, 'roles'::text)));

DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = roles.tenant_id)))) AND tenant_module_enabled(tenant_id, 'roles'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = roles.tenant_id)))) AND tenant_module_enabled(tenant_id, 'roles'::text)));

DROP POLICY IF EXISTS "staff_delete" ON staff;
CREATE POLICY "staff_delete" ON staff FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = staff.tenant_id)))) AND tenant_module_enabled(tenant_id, 'staff'::text)));

DROP POLICY IF EXISTS "staff_insert" ON staff;
CREATE POLICY "staff_insert" ON staff FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = staff.tenant_id)))) AND tenant_module_enabled(tenant_id, 'staff'::text)));

DROP POLICY IF EXISTS "staff_select" ON staff;
CREATE POLICY "staff_select" ON staff FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = staff.tenant_id)))) AND tenant_module_enabled(tenant_id, 'staff'::text)));

DROP POLICY IF EXISTS "staff_update" ON staff;
CREATE POLICY "staff_update" ON staff FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = staff.tenant_id)))) AND tenant_module_enabled(tenant_id, 'staff'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = staff.tenant_id)))) AND tenant_module_enabled(tenant_id, 'staff'::text)));

DROP POLICY IF EXISTS "se_insert" ON subscription_events;
CREATE POLICY "se_insert" ON subscription_events FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR COALESCE(((auth.jwt() ->> 'role'::text) = 'service_role'::text), false) OR ((event_type = 'subscription_created'::subscription_event_type_enum) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = subscription_events.tenant_id)))))));

DROP POLICY IF EXISTS "st_sa_insert" ON support_tickets;
CREATE POLICY "st_sa_insert" ON support_tickets FOR INSERT TO authenticated
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "st_sa_select" ON support_tickets;
CREATE POLICY "st_sa_select" ON support_tickets FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))) OR (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = support_tickets.tenant_id))))));

DROP POLICY IF EXISTS "st_sa_update" ON support_tickets;
CREATE POLICY "st_sa_update" ON support_tickets FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))) OR (user_id = (select auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_super_admin))) OR (user_id = (select auth.uid()))));

DROP POLICY IF EXISTS "surgeries_delete" ON surgeries;
CREATE POLICY "surgeries_delete" ON surgeries FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = surgeries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'surgeries'::text)));

DROP POLICY IF EXISTS "surgeries_insert" ON surgeries;
CREATE POLICY "surgeries_insert" ON surgeries FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = surgeries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'surgeries'::text)));

DROP POLICY IF EXISTS "surgeries_select" ON surgeries;
CREATE POLICY "surgeries_select" ON surgeries FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = surgeries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'surgeries'::text)));

DROP POLICY IF EXISTS "surgeries_update" ON surgeries;
CREATE POLICY "surgeries_update" ON surgeries FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = surgeries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'surgeries'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = surgeries.tenant_id)))) AND tenant_module_enabled(tenant_id, 'surgeries'::text)));

DROP POLICY IF EXISTS "telemedicine_delete" ON telemedicine_sessions;
CREATE POLICY "telemedicine_delete" ON telemedicine_sessions FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = telemedicine_sessions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'telemedicine'::text)));

DROP POLICY IF EXISTS "telemedicine_insert" ON telemedicine_sessions;
CREATE POLICY "telemedicine_insert" ON telemedicine_sessions FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = telemedicine_sessions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'telemedicine'::text)));

DROP POLICY IF EXISTS "telemedicine_select" ON telemedicine_sessions;
CREATE POLICY "telemedicine_select" ON telemedicine_sessions FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = telemedicine_sessions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'telemedicine'::text)));

DROP POLICY IF EXISTS "telemedicine_update" ON telemedicine_sessions;
CREATE POLICY "telemedicine_update" ON telemedicine_sessions FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = telemedicine_sessions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'telemedicine'::text)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = telemedicine_sessions.tenant_id)))) AND tenant_module_enabled(tenant_id, 'telemedicine'::text)));

DROP POLICY IF EXISTS "memberships_select" ON tenant_memberships;
CREATE POLICY "memberships_select" ON tenant_memberships FOR SELECT TO authenticated
  USING (((user_id = (select auth.uid())) OR is_tenant_owner(tenant_id) OR is_super_admin()));

DROP POLICY IF EXISTS "tenants_insert_own" ON tenants;
CREATE POLICY "tenants_insert_own" ON tenants FOR INSERT TO authenticated
  WITH CHECK (((select auth.uid()) = owner_user_id));

DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own" ON tenants FOR SELECT TO authenticated
  USING ((((select auth.uid()) = owner_user_id) OR is_tenant_member(id) OR is_super_admin()));

DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE TO authenticated
  USING ((((select auth.uid()) = owner_user_id) OR is_super_admin()))
  WITH CHECK ((((select auth.uid()) = owner_user_id) OR is_super_admin()));

DROP POLICY IF EXISTS "webhooks_delete" ON webhooks;
CREATE POLICY "webhooks_delete" ON webhooks FOR DELETE TO authenticated
  USING ((is_super_admin() OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = webhooks.tenant_id))))));

DROP POLICY IF EXISTS "webhooks_insert" ON webhooks;
CREATE POLICY "webhooks_insert" ON webhooks FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = webhooks.tenant_id)))) AND tenant_module_enabled(tenant_id, 'integrations'::text))));

DROP POLICY IF EXISTS "webhooks_select" ON webhooks;
CREATE POLICY "webhooks_select" ON webhooks FOR SELECT TO authenticated
  USING ((is_super_admin() OR ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = webhooks.tenant_id)))) AND tenant_module_enabled(tenant_id, 'integrations'::text))));

DROP POLICY IF EXISTS "webhooks_update" ON webhooks;
CREATE POLICY "webhooks_update" ON webhooks FOR UPDATE TO authenticated
  USING ((is_super_admin() OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = webhooks.tenant_id))))))
  WITH CHECK ((is_super_admin() OR (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = webhooks.tenant_id))))));
