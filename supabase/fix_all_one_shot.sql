-- ============================================================================
-- ONE-SHOT FIX: récursion + super admins + exemption billing (Option B)
-- ============================================================================
-- À coller ENTIÈREMENT dans: Supabase Dashboard -> SQL Editor -> Run
-- Idempotent (relançable sans risque). Corrige les 3 problèmes d'un coup:
--   1. Récursion infinie "tenants" (helpers SECURITY DEFINER + policies)
--   2. Super admins garantis (vincentnogue2@gmail.com, vincentnogue@yahoo.com)
--   3. Option B: staffs des super admins JAMAIS bloqués par le billing
-- ============================================================================

-- =========================================================================
-- PARTIE 1 — Helper functions SECURITY DEFINER (cassent la récursion RLS)
-- =========================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_super_admin FROM profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = p_tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (t.owner_user_id = auth.uid()) FROM tenants t WHERE t.id = p_tenant_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION profiles_share_tenant(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships tm_self
    JOIN tenant_memberships tm_other ON tm_other.tenant_id = tm_self.tenant_id
    WHERE tm_self.user_id = auth.uid() AND tm_other.user_id = p_other_user_id
  );
$$;

-- =========================================================================
-- PARTIE 2 — Policies tenants / tenant_memberships (sans sous-requête croisée)
-- =========================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own" ON tenants FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR is_tenant_member(tenants.id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "tenants_insert_own" ON tenants;
CREATE POLICY "tenants_insert_own" ON tenants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR is_super_admin()
  ) WITH CHECK (
    auth.uid() = owner_user_id
    OR is_super_admin()
  );

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

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

-- =========================================================================
-- PARTIE 3 — Profiles / audit_logs / branches (sans récursion)
-- =========================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_tenant_colleagues_select" ON profiles;
CREATE POLICY "profiles_tenant_colleagues_select" ON profiles FOR SELECT
  TO authenticated USING (profiles_share_tenant(profiles.id));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

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

-- =========================================================================
-- PARTIE 4 — Super admins garantis
-- =========================================================================

CREATE TABLE IF NOT EXISTS protected_admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE protected_admin_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pae_select" ON protected_admin_emails;
CREATE POLICY "pae_select" ON protected_admin_emails FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pae_insert" ON protected_admin_emails;
CREATE POLICY "pae_insert" ON protected_admin_emails FOR INSERT TO authenticated WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "pae_update" ON protected_admin_emails;
CREATE POLICY "pae_update" ON protected_admin_emails FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "pae_delete" ON protected_admin_emails;
CREATE POLICY "pae_delete" ON protected_admin_emails FOR DELETE TO authenticated USING (is_super_admin());

INSERT INTO protected_admin_emails (email)
SELECT lower(e) FROM (VALUES
  ('vincentnogue2@gmail.com'),
  ('vincentnogue@yahoo.com'),
  ('webdxb1@gmail.com'),
  ('liyahjoha@gmail.com')
) AS t(e)
ON CONFLICT (email) DO NOTHING;

-- Backfill: promouvoir les users existants de ces emails en super admin
UPDATE public.profiles p
SET is_super_admin = true
FROM auth.users u, protected_admin_emails e
WHERE p.id = u.id
  AND lower(u.email) = lower(e.email)
  AND p.is_super_admin = false;

-- Trigger: futurs signups de ces emails -> auto super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_protected_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM protected_admin_emails WHERE lower(email) = lower(NEW.email)
  ) INTO is_protected_admin;

  INSERT INTO public.profiles (id, full_name, is_super_admin, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    is_protected_admin,
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET is_super_admin = GREATEST(profiles.is_super_admin, is_protected_admin),
        email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- PARTIE 5 — Option B: staffs des super admins JAMAIS bloqués par le billing
-- =========================================================================
-- tenant_billing_active() retourne true si le propriétaire du tenant est
-- super admin. Ainsi, le staff (membres non-super-admin) d'un tenant créé
-- par un super admin n'est jamais bloqué par l'expiration d'essai, même
-- après la période d'essai. Le super admin gère ses propres tenants sans
-- contrainte de paiement.

CREATE OR REPLACE FUNCTION tenant_billing_active(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR COALESCE(
      (SELECT
        -- Option B: tenant appartenant à un super admin -> toujours actif
        owner_p.is_super_admin
        -- Branche normale: statut approuvé + plan, ou essai/grace
        OR (t.status = 'approved' AND t.plan_id IS NOT NULL)
        OR t.trial_ends_at > now()
        OR COALESCE(t.grace_period_ends_at, t.trial_ends_at + interval '3 days') > now()
       FROM tenants t
       LEFT JOIN profiles owner_p ON owner_p.id = t.owner_user_id
       WHERE t.id = p_tenant_id),
      false
    );
$$;

-- =========================================================================
-- PARTIE 6 — Vérification
-- =========================================================================

-- Affiche les super admins
SELECT '=== Super admins ===' AS info;
SELECT u.email, p.is_super_admin
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_super_admin = true;

-- Affiche les policies (aucune ne doit contenir de sous-requête croisée brute)
SELECT '=== Policies tenants ===' AS info;
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('tenants','tenant_memberships','profiles','audit_logs','branches')
ORDER BY tablename, policyname;
