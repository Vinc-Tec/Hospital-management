
-- Login activity tracking table
CREATE TABLE IF NOT EXISTS login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  session_duration_sec integer,
  ip_address text,
  country text,
  city text,
  device text,
  browser text,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_activity_user_id ON login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_tenant_id ON login_activity(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_login_at ON login_activity(login_at DESC);

-- Enable RLS
ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;

-- Super admins can see all login activity
CREATE POLICY "login_activity_sa_select" ON login_activity FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  );

-- Tenant admins can see only their own tenant's login activity
CREATE POLICY "login_activity_tenant_select" ON login_activity FOR SELECT
  TO authenticated USING (
    tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = login_activity.tenant_id AND tm.role = 'admin'
    )
  );

-- Users can insert their own login activity (for login tracking on signin)
CREATE POLICY "login_activity_insert_own" ON login_activity FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can update their own login activity (for logout tracking)
CREATE POLICY "login_activity_update_own" ON login_activity FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Allow inserting login activity for failed logins (no authenticated user)
-- We use a permissive insert for anon as well, but only for recording failures
CREATE POLICY "login_activity_insert_anon" ON login_activity FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Add onboarding_completed flag to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Add email column to profiles for super admin email matching
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Ensure protected super admin emails are marked as super admins
-- (This runs once; the auth trigger handles future registrations)
INSERT INTO profiles (id, is_super_admin, email)
SELECT u.id, true, u.email
FROM auth.users u
WHERE lower(u.email) IN (
  'vincentnogue2@gmail.com',
  'vincentnogue@yahoo.com',
  'webdxb1@gmail.com',
  'liyahjoha@gmail.com'
)
ON CONFLICT (id) DO UPDATE SET
  is_super_admin = true,
  email = EXCLUDED.email;
