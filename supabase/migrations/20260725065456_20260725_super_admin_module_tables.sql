
-- Create tables for Super Admin modules: commercial_codes, support_tickets, api_keys, platform_notifications

-- Commercial codes (marketplace)
CREATE TABLE IF NOT EXISTS commercial_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  country_iso text,
  description text,
  discount_percent numeric DEFAULT 0,
  max_uses integer,
  uses_count integer DEFAULT 0,
  valid_until date,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE commercial_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc_sa_select" ON commercial_codes;
CREATE POLICY "cc_sa_select" ON commercial_codes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));
DROP POLICY IF EXISTS "cc_sa_insert" ON commercial_codes;
CREATE POLICY "cc_sa_insert" ON commercial_codes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));
DROP POLICY IF EXISTS "cc_sa_update" ON commercial_codes;
CREATE POLICY "cc_sa_update" ON commercial_codes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text,
  priority text DEFAULT 'low',
  status text DEFAULT 'open',
  resolution text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "st_sa_select" ON support_tickets;
CREATE POLICY "st_sa_select" ON support_tickets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin) OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = support_tickets.tenant_id));
DROP POLICY IF EXISTS "st_sa_insert" ON support_tickets;
CREATE POLICY "st_sa_insert" ON support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st_sa_update" ON support_tickets;
CREATE POLICY "st_sa_update" ON support_tickets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin) OR user_id = auth.uid()) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin) OR user_id = auth.uid());

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] DEFAULT ARRAY['read'],
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ak_sa_select" ON api_keys;
CREATE POLICY "ak_sa_select" ON api_keys FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));
DROP POLICY IF EXISTS "ak_sa_insert" ON api_keys;
CREATE POLICY "ak_sa_insert" ON api_keys FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));
DROP POLICY IF EXISTS "ak_sa_update" ON api_keys;
CREATE POLICY "ak_sa_update" ON api_keys FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));

-- Platform notifications
CREATE TABLE IF NOT EXISTS platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text,
  target text DEFAULT 'all',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE platform_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pn_all_select" ON platform_notifications;
CREATE POLICY "pn_all_select" ON platform_notifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pn_sa_insert" ON platform_notifications;
CREATE POLICY "pn_sa_insert" ON platform_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin));
