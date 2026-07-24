/*
# Multi-branch architecture + tenant currency/timezone + plan limits

Adds:
- branches table for multi-branch healthcare organizations
- currency_code, timezone, accounting_mode columns to tenants
- max_branches, max_storage_gb to subscription_plans
*/

-- Add currency and timezone to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'XAF';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Douala';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accounting_mode text DEFAULT 'consolidated' CHECK (accounting_mode IN ('per_branch','consolidated','both'));

-- Add branch + storage limits to plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_branches integer DEFAULT 1 CHECK (max_branches >= 1);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_storage_gb integer DEFAULT 5 CHECK (max_storage_gb >= 1);

-- Update existing plans with branch limits
UPDATE subscription_plans SET max_branches = 1, max_storage_gb = 5 WHERE code = 'starter';
UPDATE subscription_plans SET max_branches = 3, max_storage_gb = 20 WHERE code = 'professional';
UPDATE subscription_plans SET max_branches = 10, max_storage_gb = 100 WHERE code = 'business';
UPDATE subscription_plans SET max_branches = 999, max_storage_gb = 1000 WHERE code = 'enterprise';

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  healthcare_type text NOT NULL DEFAULT 'hospital',
  is_head_office boolean NOT NULL DEFAULT false,
  address text,
  phone text,
  email text,
  city_id uuid REFERENCES cities(id),
  district_id uuid REFERENCES districts(id),
  region_id uuid REFERENCES regions(id),
  country_id uuid REFERENCES countries(id),
  gps_lat double precision,
  gps_lng double precision,
  manager_name text,
  manager_phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branches_tenant_id_idx ON branches(tenant_id);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_branches" ON branches FOR SELECT
  TO authenticated USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      LEFT JOIN tenant_memberships m ON m.tenant_id = t.id AND m.user_id = auth.uid()
      WHERE t.owner_user_id = auth.uid() OR m.user_id = auth.uid()
    )
  );
CREATE POLICY "insert_own_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (
    tenant_id IN (
      SELECT t.id FROM tenants t
      LEFT JOIN tenant_memberships m ON m.tenant_id = t.id AND m.user_id = auth.uid()
      WHERE t.owner_user_id = auth.uid() OR m.user_id = auth.uid()
    )
  );
CREATE POLICY "update_own_branches" ON branches FOR UPDATE
  TO authenticated USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      LEFT JOIN tenant_memberships m ON m.tenant_id = t.id AND m.user_id = auth.uid()
      WHERE t.owner_user_id = auth.uid() OR m.user_id = auth.uid()
    )
  );
CREATE POLICY "delete_own_branches" ON branches FOR DELETE
  TO authenticated USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      LEFT JOIN tenant_memberships m ON m.tenant_id = t.id AND m.user_id = auth.uid()
      WHERE t.owner_user_id = auth.uid() OR m.user_id = auth.uid()
    )
  );
