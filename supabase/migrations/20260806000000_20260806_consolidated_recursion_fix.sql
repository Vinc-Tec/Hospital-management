-- Consolidated, self-contained recursion fix. Equivalent to running
-- fix_recursion_one_shot.sql in the SQL Editor. Idempotent.
-- See supabase/fix_recursion_one_shot.sql for the human-readable version.

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT p.is_super_admin FROM profiles p WHERE p.id = auth.uid()), false); $$;

CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = p_tenant_id); $$;

CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT (t.owner_user_id = auth.uid()) FROM tenants t WHERE t.id = p_tenant_id), false); $$;

-- profiles colleague-visibility helper (removes inline tenant_memberships
-- self-join that was the last remaining recursion entry-point).
CREATE OR REPLACE FUNCTION profiles_share_tenant(p_other_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships tm_self
    JOIN tenant_memberships tm_other ON tm_other.tenant_id = tm_self.tenant_id
    WHERE tm_self.user_id = auth.uid() AND tm_other.user_id = p_other_user_id
  );
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own" ON tenants FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR is_tenant_member(tenants.id) OR is_super_admin());
DROP POLICY IF EXISTS "tenants_insert_own" ON tenants;
CREATE POLICY "tenants_insert_own" ON tenants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);
DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id OR is_super_admin())
  WITH CHECK (auth.uid() = owner_user_id OR is_super_admin());

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_select" ON tenant_memberships;
CREATE POLICY "memberships_select" ON tenant_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_tenant_owner(tenant_memberships.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "memberships_insert" ON tenant_memberships;
CREATE POLICY "memberships_insert" ON tenant_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_tenant_owner(tenant_memberships.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "memberships_update" ON tenant_memberships;
CREATE POLICY "memberships_update" ON tenant_memberships FOR UPDATE TO authenticated
  USING (is_tenant_owner(tenant_memberships.tenant_id) OR is_super_admin())
  WITH CHECK (is_tenant_owner(tenant_memberships.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "memberships_delete" ON tenant_memberships;
CREATE POLICY "memberships_delete" ON tenant_memberships FOR DELETE TO authenticated
  USING (is_tenant_owner(tenant_memberships.tenant_id) OR is_super_admin());

-- profiles colleague-visibility rewritten to use the helper (no inline join).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_tenant_colleagues_select" ON profiles;
CREATE POLICY "profiles_tenant_colleagues_select" ON profiles FOR SELECT TO authenticated
  USING (profiles_share_tenant(profiles.id));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR is_tenant_owner(audit_logs.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated
  USING (is_tenant_member(audit_logs.tenant_id) OR is_super_admin());

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_branches" ON branches;
CREATE POLICY "select_own_branches" ON branches FOR SELECT TO authenticated
  USING (is_tenant_member(branches.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "insert_own_branches" ON branches;
CREATE POLICY "insert_own_branches" ON branches FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(branches.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "update_own_branches" ON branches;
CREATE POLICY "update_own_branches" ON branches FOR UPDATE TO authenticated
  USING (is_tenant_member(branches.tenant_id) OR is_super_admin())
  WITH CHECK (is_tenant_member(branches.tenant_id) OR is_super_admin());
DROP POLICY IF EXISTS "delete_own_branches" ON branches;
CREATE POLICY "delete_own_branches" ON branches FOR DELETE TO authenticated
  USING (is_tenant_member(branches.tenant_id) OR is_super_admin());
