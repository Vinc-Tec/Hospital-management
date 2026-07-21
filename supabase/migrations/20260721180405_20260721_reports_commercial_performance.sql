/*
# Reports, Commercial Codes, Staff Performance, Enhanced Roles

## Summary
1. `reports` table — user-generated reports with PDF/WhatsApp export
2. `commercial_codes` table — promo codes created by super admin
3. `staff_performance` view — aggregated metrics per doctor per tenant
4. `is_super_admin_email()` function — email whitelist for super admin access

## New Tables
### reports
- id, tenant_id, user_id, title, report_type, content, metadata, status, created_at, updated_at
### commercial_codes
- id, code, description, discount_percent, max_uses, uses_count, valid_from, valid_until, created_by, is_active, created_at

## Security
- RLS on all new tables
- reports: tenant-scoped CRUD
- commercial_codes: super admin only
*/

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'custom',
  content text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_tenant_member(tenant_id) OR is_super_admin());

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_update_own" ON reports;
CREATE POLICY "reports_update_own" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reports_delete_own" ON reports;
CREATE POLICY "reports_delete_own" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR is_super_admin());

-- Commercial codes table
CREATE TABLE IF NOT EXISTS commercial_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  discount_percent numeric DEFAULT 0,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE commercial_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_codes_select_admin" ON commercial_codes;
CREATE POLICY "commercial_codes_select_admin" ON commercial_codes FOR SELECT
  TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "commercial_codes_insert_admin" ON commercial_codes;
CREATE POLICY "commercial_codes_insert_admin" ON commercial_codes FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "commercial_codes_update_admin" ON commercial_codes;
CREATE POLICY "commercial_codes_update_admin" ON commercial_codes FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "commercial_codes_delete_admin" ON commercial_codes;
CREATE POLICY "commercial_codes_delete_admin" ON commercial_codes FOR DELETE
  TO authenticated USING (is_super_admin());

-- Super admin email whitelist function
CREATE OR REPLACE FUNCTION is_super_admin_email(email_to_check text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  check_email text;
  whitelist text[] := ARRAY[
    'vincentnogue2@gmail.com',
    'vincentnogue@yahoo.com',
    'webdxb1@gmail.com'
  ];
  user_email text;
BEGIN
  IF email_to_check IS NOT NULL THEN
    check_email := lower(trim(email_to_check));
    RETURN check_email = ANY(whitelist);
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN RETURN false; END IF;
  RETURN lower(trim(user_email)) = ANY(whitelist);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff/doctor performance view (aggregated metrics per doctor per tenant)
CREATE OR REPLACE VIEW staff_performance AS
SELECT
  d.tenant_id,
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
LEFT JOIN (SELECT tenant_id, doctor_id, count(*) AS cnt FROM appointments WHERE doctor_id IS NOT NULL GROUP BY tenant_id, doctor_id) apt
  ON apt.tenant_id = d.tenant_id AND apt.doctor_id = d.id
LEFT JOIN (SELECT tenant_id, doctor_id, count(*) AS cnt FROM consultations WHERE doctor_id IS NOT NULL GROUP BY tenant_id, doctor_id) con
  ON con.tenant_id = d.tenant_id AND con.doctor_id = d.id
LEFT JOIN (SELECT tenant_id, doctor_id, count(*) AS cnt FROM prescriptions WHERE doctor_id IS NOT NULL GROUP BY tenant_id, doctor_id) pre
  ON pre.tenant_id = d.tenant_id AND pre.doctor_id = d.id
LEFT JOIN (SELECT tenant_id, doctor_id, count(*) AS cnt FROM lab_orders WHERE doctor_id IS NOT NULL GROUP BY tenant_id, doctor_id) lab
  ON lab.tenant_id = d.tenant_id AND lab.doctor_id = d.id
LEFT JOIN (SELECT tenant_id, doctor_id, count(*) AS cnt FROM radiology_orders WHERE doctor_id IS NOT NULL GROUP BY tenant_id, doctor_id) rad
  ON rad.tenant_id = d.tenant_id AND rad.doctor_id = d.id;

-- Ensure roles.permissions has a default
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'permissions' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE roles ALTER COLUMN permissions SET DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_tenant_user ON reports(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_codes_active ON commercial_codes(is_active) WHERE is_active = true;
