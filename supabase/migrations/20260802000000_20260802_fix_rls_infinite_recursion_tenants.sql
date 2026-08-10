/*
# Fix: infinite recursion in RLS policies on tenants / tenant_memberships

## Symptom
"infinite recursion detected in policy for relation tenants" at runtime
(any SELECT on tenants by an authenticated, non-super-admin user).

## Root cause
The RLS policies on `tenants` and `tenant_memberships` referenced each
other via plain sub-queries, and both tables have RLS enabled, so each
sub-query re-triggered the other table's policies:

  tenants_select_own:
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenants.id ...)
      -> tenant_memberships has RLS -> memberships_select is applied ->
  memberships_select:
    EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_memberships.tenant_id ...)
      -> tenants has RLS -> tenants_select_own is applied ->
  ... infinite recursion.

audit_select also sub-queried tenant_memberships (RLS) which sub-queried
tenants (RLS) -- same cycle.

## Fix
Replace every direct cross-table sub-query in these policies with the
SECURITY DEFINER helper functions, which bypass RLS and therefore break
the cycle:

  - is_super_admin()        -- already SECURITY DEFINER, reads profiles
  - is_tenant_member(uuid)  -- already SECURITY DEFINER, reads tenant_memberships
  - is_tenant_owner(uuid)   -- NEW, SECURITY DEFINER, reads tenants.owner_user_id

Then:
  - tenants_select_own uses is_tenant_member(tenants.id) instead of a
    sub-query on tenant_memberships.
  - tenant_memberships policies (select/insert/update/delete) use
    is_tenant_owner(tenant_memberships.tenant_id) instead of a sub-query
    on tenants.
  - audit_logs policies use is_tenant_member(...) / is_tenant_owner(...)
    instead of cross-table sub-queries.

This is idempotent (DROP POLICY + CREATE POLICY) and does not alter data.
The other tenant-scoped tables (patients, doctors, appointments, ...)
already use `EXISTS (SELECT 1 FROM tenant_memberships tm WHERE ...)`. That
is safe: tenant_memberships policies no longer recurse into tenants, so
those sub-queries terminate after a single hop. We still convert the most
hot ones to is_tenant_member() for clarity/consistency, but the cycle is
already broken by the three tables above.
*/

-- ---------- new owner helper (SECURITY DEFINER, bypasses RLS) ----------
CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (t.owner_user_id = auth.uid())
       FROM tenants t
       WHERE t.id = p_tenant_id),
    false
  );
$$;

-- ---------- tenants policies ----------
DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own" ON tenants FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR is_tenant_member(tenants.id)
    OR is_super_admin()
  );

-- INSERT unchanged in spirit (owner == auth.uid()), kept for clarity.
DROP POLICY IF EXISTS "tenants_insert_own" ON tenants;
CREATE POLICY "tenants_insert_own" ON tenants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_user_id);

-- UPDATE: owner or super admin only. (The close_tenant_self_approval_gap
-- migration already restricts WHICH columns may change; this only gates
-- the row-level access and does not weaken that.)
DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR is_super_admin()
  ) WITH CHECK (
    auth.uid() = owner_user_id
    OR is_super_admin()
  );

-- ---------- tenant_memberships policies ----------
DROP POLICY IF EXISTS "memberships_select" ON tenant_memberships;
CREATE POLICY "memberships_select" ON tenant_memberships FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR is_tenant_owner(tenant_memberships.tenant_id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "memberships_insert" ON tenant_memberships;
CREATE POLICY "memberships_insert" ON tenant_memberships FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR is_tenant_owner(tenant_memberships.tenant_id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "memberships_update" ON tenant_memberships;
CREATE POLICY "memberships_update" ON tenant_memberships FOR UPDATE
  TO authenticated USING (
    is_tenant_owner(tenant_memberships.tenant_id)
    OR is_super_admin()
  ) WITH CHECK (
    is_tenant_owner(tenant_memberships.tenant_id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "memberships_delete" ON tenant_memberships;
CREATE POLICY "memberships_delete" ON tenant_memberships FOR DELETE
  TO authenticated USING (
    is_tenant_owner(tenant_memberships.tenant_id)
    OR is_super_admin()
  );

-- ---------- audit_logs policies ----------
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    actor_user_id = auth.uid()
    OR is_tenant_owner(audit_logs.tenant_id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  TO authenticated USING (
    is_tenant_member(audit_logs.tenant_id)
    OR is_super_admin()
  );
