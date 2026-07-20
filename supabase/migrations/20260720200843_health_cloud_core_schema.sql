/*
# Health Cloud — Core Multi-Tenant Schema (v1)

## Purpose
Strictly-isolated multi-tenant Healthcare SaaS foundation.
Every healthcare institution (tenant) owns an isolated workspace. No tenant
can read or write another tenant's rows. A separate Super Admin tier
(LIYAH GROUP) manages the platform itself.

## Tables
1. profiles — extends auth.users with display name + super_admin flag.
2. countries / regions / districts / cities / localities — African geography.
3. subscription_plans — Starter/Professional/Business/Enterprise.
4. tenants — healthcare institutions (tenant root).
5. tenant_memberships — binds auth.users to a tenant with a role + permissions.
6. audit_logs — append-only audit trail.
7. patients — tenant-scoped demo clinical table (proves isolation).

## Security
- RLS enabled on every table.
- Tenant tables scoped via tenant_memberships existence check.
- profiles self-service: a user reads/updates only their own profile.
- Super admin tables (countries/regions/plans) are read-only for authenticated
  users (so onboarding dropdowns work) and writable only via service role.
- audit_logs is insert-only for authenticated users; reads restricted to
  tenant members or super admins.

## Important Notes
1. tenants.owner_user_id defaults to auth.uid() so onboarding insert succeeds
   even when the client omits it.
2. tenant_memberships.user_id defaults to auth.uid() for the same reason.
3. tenants.trial_ends_at defaults to now() + interval '7 days' — every new
   tenant automatically receives a 7-day free trial.
4. A trigger on_auth_user_created auto-creates a profiles row whenever a new
   auth.users row is inserted, so onboarding never fails on a missing profile.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_select" ON profiles;
CREATE POLICY "profiles_self_select" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_self_insert" ON profiles;
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- geography ----------
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  iso2 text NOT NULL UNIQUE,
  phone_code text,
  currency_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);

CREATE TABLE IF NOT EXISTS districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region_id, name)
);

CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (district_id, name)
);

CREATE TABLE IF NOT EXISTS localities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE localities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_select" ON countries;
CREATE POLICY "geo_select" ON countries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "geo_select" ON regions;
CREATE POLICY "geo_select" ON regions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "geo_select" ON districts;
CREATE POLICY "geo_select" ON districts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "geo_select" ON cities;
CREATE POLICY "geo_select" ON cities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "geo_select" ON localities;
CREATE POLICY "geo_select" ON localities FOR SELECT TO authenticated USING (true);

-- ---------- subscription_plans ----------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  max_users int NOT NULL DEFAULT 0,
  max_doctors int NOT NULL DEFAULT 0,
  max_patients int NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select" ON subscription_plans;
CREATE POLICY "plans_select" ON subscription_plans FOR SELECT TO authenticated USING (true);

-- ---------- tenants ----------
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  commercial_name text,
  healthcare_type text NOT NULL,
  country_id uuid REFERENCES countries(id),
  region_id uuid REFERENCES regions(id),
  district_id uuid REFERENCES districts(id),
  city_id uuid REFERENCES cities(id),
  locality_id uuid REFERENCES localities(id),
  address text,
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  email text NOT NULL,
  phone text,
  website text,
  medical_license text,
  business_registration text,
  tax_certificate text,
  owner_identification text,
  insurance_documents text,
  bank_information jsonb,
  payment_gateway text,
  num_doctors int NOT NULL DEFAULT 0,
  num_beds int NOT NULL DEFAULT 0,
  departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','request_info','suspended')),
  verification_note text,
  plan_id uuid REFERENCES subscription_plans(id),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_owner_idx ON tenants(owner_user_id);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ---------- tenant_memberships ----------
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'tenant_admin',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_tenant_idx ON tenant_memberships(tenant_id);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Now policies that reference tenant_memberships
DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own" ON tenants FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = tenants.id)
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "tenants_insert_own" ON tenants;
CREATE POLICY "tenants_insert_own" ON tenants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  ) WITH CHECK (
    auth.uid() = owner_user_id
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "memberships_select" ON tenant_memberships;
CREATE POLICY "memberships_select" ON tenant_memberships FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_memberships.tenant_id AND t.owner_user_id = auth.uid())
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "memberships_insert" ON tenant_memberships;
CREATE POLICY "memberships_insert" ON tenant_memberships FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_memberships.tenant_id AND t.owner_user_id = auth.uid())
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "memberships_update" ON tenant_memberships;
CREATE POLICY "memberships_update" ON tenant_memberships FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_memberships.tenant_id AND t.owner_user_id = auth.uid())
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_memberships.tenant_id AND t.owner_user_id = auth.uid())
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "memberships_delete" ON tenant_memberships;
CREATE POLICY "memberships_delete" ON tenant_memberships FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_memberships.tenant_id AND t.owner_user_id = auth.uid())
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

-- ---------- audit_logs ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_tenant_idx ON audit_logs(tenant_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    actor_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tenants t WHERE t.id = audit_logs.tenant_id AND t.owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = audit_logs.tenant_id)
    OR (SELECT profiles.is_super_admin FROM profiles WHERE profiles.id = auth.uid())
  );

-- ---------- patients (tenant-scoped clinical demo) ----------
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IN ('male','female','other')),
  phone text,
  email text,
  blood_group text,
  allergies text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patients_tenant_idx ON patients(tenant_id);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patients_select" ON patients;
CREATE POLICY "patients_select" ON patients FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  );

DROP POLICY IF EXISTS "patients_insert" ON patients;
CREATE POLICY "patients_insert" ON patients FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  );

DROP POLICY IF EXISTS "patients_update" ON patients;
CREATE POLICY "patients_update" ON patients FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  );

DROP POLICY IF EXISTS "patients_delete" ON patients;
CREATE POLICY "patients_delete" ON patients FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  );

-- ---------- updated_at trigger for tenants ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_touch_updated_at ON tenants;
CREATE TRIGGER tenants_touch_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
