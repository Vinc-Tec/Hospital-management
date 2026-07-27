/*
# Security hardening (P0) — post-audit

## Summary
1. Adds `is_super_admin()` and `is_tenant_member(uuid)` helper functions.
   These were referenced by earlier migrations (reports/billing schemas)
   but were never actually defined anywhere in the migration history —
   they existed only as manual, unversioned edits in the Supabase SQL
   editor. Committing them here makes the schema reproducible from git.
2. Fixes a privilege-escalation bug: `profiles_self_update` allowed any
   authenticated user to set their OWN `is_super_admin` flag to true via
   a direct PostgREST call, bypassing the client-side email whitelist
   (which is UI-only and not a security control). Only an existing super
   admin may now change that flag on any profile, including their own.
3. Fixes a cross-tenant data leak in `get_staff_performance(p_tenant_id)`:
   the function is SECURITY DEFINER and previously never checked that the
   caller actually belongs to `p_tenant_id`, so any authenticated user of
   any tenant could read another tenant's doctor performance stats.
4. Removes the fully-open anonymous INSERT policy on `login_activity`
   (`WITH CHECK (true)` for anon+authenticated). `user_id` is NOT NULL on
   that table, so an anonymous insert could never satisfy the constraint
   anyway — the policy was dead weight that only widened the attack
   surface for log-injection attempts. Authenticated users can still
   insert/update their own login activity via the existing
   `login_activity_insert_own` / `login_activity_update_own` policies.

## Notes
This migration is idempotent (CREATE OR REPLACE / DROP POLICY IF EXISTS)
and safe to run on a database where the fixes were already applied by
hand, or on a fresh database built from migrations 1-10.
*/

-- ---------- helper functions (previously undocumented / manual-only) ----------
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

-- ---------- FIX #1: prevent self-promotion to super admin ----------
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_super_admin = (SELECT p2.is_super_admin FROM profiles p2 WHERE p2.id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_super_admin_manage" ON profiles;
CREATE POLICY "profiles_super_admin_manage" ON profiles FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ---------- FIX #2: enforce tenant membership in get_staff_performance ----------
CREATE OR REPLACE FUNCTION get_staff_performance(p_tenant_id uuid)
RETURNS TABLE (
  doctor_id uuid,
  first_name text,
  last_name text,
  specialty text,
  status text,
  appointments_count bigint,
  consultations_count bigint,
  prescriptions_count bigint,
  lab_orders_count bigint,
  radiology_orders_count bigint
) AS $$
BEGIN
  IF NOT (is_tenant_member(p_tenant_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: not a member of this tenant';
  END IF;

  RETURN QUERY
  SELECT
    d.id AS doctor_id,
    d.first_name,
    d.last_name,
    d.specialty,
    d.status,
    COALESCE(apt.cnt, 0) AS appointments_count,
    COALESCE(con.cnt, 0) AS consultations_count,
    COALESCE(pre.cnt, 0) AS prescriptions_count,
    COALESCE(lab.cnt, 0) AS lab_orders_count,
    COALESCE(rad.cnt, 0) AS radiology_orders_count
  FROM doctors d
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM appointments WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) apt ON apt.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM consultations WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) con ON con.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM prescriptions WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) pre ON pre.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM lab_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) lab ON lab.doctor_id = d.id
  LEFT JOIN (SELECT doctor_id, count(*) AS cnt FROM radiology_orders WHERE tenant_id = p_tenant_id AND doctor_id IS NOT NULL GROUP BY doctor_id) rad ON rad.doctor_id = d.id
  WHERE d.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- FIX #3: remove open anonymous insert on login_activity ----------
DROP POLICY IF EXISTS "login_activity_insert_anon" ON login_activity;
