/*
 * Bulletproof RLS recursion guard (companion to 20260802_fix_rls_infinite_recursion_tenants).
 *
 * The infinite recursion "infinite recursion detected in policy for relation
 * tenants" is caused by the mutual RLS dependency tenants <-> tenant_memberships.
 * Migration 20260802000000 broke that cycle by rewriting the tenants,
 * tenant_memberships and audit_logs policies to call SECURITY DEFINER helper
 * functions (is_super_admin / is_tenant_member / is_tenant_owner) which bypass
 * RLS. The other tenant-scoped tables only trigger tenant_memberships RLS once
 * and then terminate through those helpers, so they do NOT recurse.
 *
 * This migration makes that fix bulletproof:
 *   1. Recreates the three helper functions so they are unambiguously
 *      SECURITY DEFINER with a pinned search_path. In Supabase, migration
 *      functions are owned by the `postgres` role (which has BYPASSRLS), so
 *      SECURITY DEFINER functions bypass RLS regardless of the caller.
 *   2. Rewrites the `branches` policies, whose original `tenant_id IN
 *      (SELECT t.id FROM tenants t LEFT JOIN tenant_memberships m ...)`
 *      form was the one remaining cross-join that referenced BOTH tenants and
 *      tenant_memberships directly inside a policy. It now uses the helpers.
 *
 * Idempotent (DROP POLICY IF EXISTS + CREATE POLICY). No data change.
 */

-- ---------- guarantee helper functions bypass RLS ----------
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_super_admin FROM profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = p_tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (t.owner_user_id = auth.uid())
       FROM tenants t WHERE t.id = p_tenant_id),
    false
  );
$$;

-- ---------- branches: replace cross-join with helpers ----------
DROP POLICY IF EXISTS "select_own_branches" ON branches;
CREATE POLICY "select_own_branches" ON branches FOR SELECT
  TO authenticated USING (is_tenant_member(branches.tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "insert_own_branches" ON branches;
CREATE POLICY "insert_own_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (is_tenant_member(branches.tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "update_own_branches" ON branches;
CREATE POLICY "update_own_branches" ON branches FOR UPDATE
  TO authenticated
  USING (is_tenant_member(branches.tenant_id) OR is_super_admin())
  WITH CHECK (is_tenant_member(branches.tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "delete_own_branches" ON branches;
CREATE POLICY "delete_own_branches" ON branches FOR DELETE
  TO authenticated USING (is_tenant_member(branches.tenant_id) OR is_super_admin());
