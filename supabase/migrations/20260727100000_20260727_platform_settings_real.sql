/*
# Real platform settings (replaces the localStorage-only fake "System Settings")

## Why
The Super Admin "System Settings" and "AI Configuration" screens saved to
the browser's localStorage and were never read anywhere else in the app --
changing "Trial Days" to 30 had zero effect on actual trial length, and
"Maintenance Mode" blocked nothing. This migration adds a real, singleton,
database-backed settings table so these values actually do something.

"AI Configuration" is removed from the app entirely (not faked further):
there is no actual AI-powered feature in Health Cloud today for a model/
temperature/token setting to control, so persisting it -- even to a real
table -- would still control nothing. Better to remove a decorative
control than to make it "real" while it still does nothing.
*/

CREATE TABLE IF NOT EXISTS platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- enforces a single row
  platform_name text NOT NULL DEFAULT 'Health Cloud',
  support_email text NOT NULL DEFAULT 'support@liyahgroup.com',
  trial_days int NOT NULL DEFAULT 7 CHECK (trial_days > 0),
  max_tenants int CHECK (max_tenants IS NULL OR max_tenants > 0),
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_settings_select" ON platform_settings;
CREATE POLICY "platform_settings_select" ON platform_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "platform_settings_update" ON platform_settings;
CREATE POLICY "platform_settings_update" ON platform_settings FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Enforce max_tenants for real (was previously just a displayed number)
CREATE OR REPLACE FUNCTION check_max_tenants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT max_tenants INTO v_max FROM platform_settings WHERE id = true;
  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM tenants;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'platform_tenant_limit_reached: the platform has reached its configured maximum number of institutions (%). Contact the platform administrator.', v_max;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_check_max_tenants ON tenants;
CREATE TRIGGER trg_check_max_tenants BEFORE INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION check_max_tenants();
