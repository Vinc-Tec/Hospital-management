/*
# CRITICAL: close a super-admin privilege escalation

profiles_self_update allowed any authenticated user to UPDATE their own
profiles row with no column restriction: USING (auth.uid() = id) WITH
CHECK (auth.uid() = id). This let ANY user run
  UPDATE profiles SET is_super_admin = true WHERE id = auth.uid()
and grant themselves full Super Admin access to every tenant on the
platform. The separate profiles_super_admin_manage policy (which lets
an existing super admin manage other profiles) did not prevent this,
since profiles_self_update is evaluated independently and RLS policies
are permissive (OR'd together).

Fix, mirroring the existing fn_lock_tenant_billing_cols pattern already
used for tenants: a BEFORE UPDATE trigger that silently freezes
is_super_admin back to its previous value on any UPDATE not performed
by an existing super admin or the service role. This is defense in
depth underneath the RLS policy, not a replacement for it.

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

CREATE OR REPLACE FUNCTION fn_lock_profiles_super_admin_col()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_super_admin() OR COALESCE(auth.jwt() ->> 'role' = 'service_role', false)) THEN
    NEW.is_super_admin := OLD.is_super_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_profiles_super_admin_col ON profiles;
CREATE TRIGGER trg_lock_profiles_super_admin_col
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_lock_profiles_super_admin_col();
