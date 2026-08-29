/*
# Close cross-tenant content injection via audit_logs and reports

audit_insert allowed: (actor_user_id = auth.uid()) OR is_tenant_owner(...)
OR is_super_admin() -- the first clause never checked tenant_id at all,
so any authenticated user could insert an audit_logs row for ANY
tenant, self-attributed. Confirmed no client code relies on this (the
only real audit inserts come from fn_audit_tenant_insert, a
SECURITY DEFINER trigger that bypasses RLS entirely), so tightening
this to require real tenant membership breaks nothing legitimate.

reports_insert_own allowed: (auth.uid() = user_id) -- also no tenant_id
check. Combined with reports_select_own (which lets any tenant member
see reports for their tenant_id), this meant a user could insert a
report row carrying ANOTHER tenant's id and it would show up in that
tenant's Reports module for its real staff to see -- a content
injection path into a tenant the attacker was never a member of.

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    is_super_admin()
    OR (
      actor_user_id = auth.uid()
      AND (tenant_id IS NULL OR is_tenant_member(tenant_id))
    )
  );

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (tenant_id IS NULL OR is_tenant_member(tenant_id))
  );
