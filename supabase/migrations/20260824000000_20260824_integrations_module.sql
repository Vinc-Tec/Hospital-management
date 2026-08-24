/*
# Integrations module + fix: 'api' module flag was never seeded

## Bug fixed
`tenant_module_enabled()` (see 20260726_rls_plan_gating_hardening) reads
`subscription_plans.module_flags ->> 'api'` and treats a MISSING key as
false (COALESCE(..., false)). The Business plan advertises "API Access"
and Enterprise advertises "Custom integrations" on the landing page
(src/pages/Landing.tsx), and 20260729_api_keys_tenant_scoping gates
tenant-owned API keys behind that same 'api' flag -- but no migration
ever actually set `module_flags->>'api'` to true for any plan. Every
paying Business/Enterprise tenant was silently blocked by RLS from
creating or viewing their own API keys, even though they were sold the
feature. This migration merges `"api": true` into those two plans
without touching any other flag.

## New feature: Integrations module
Adds a tenant-facing "Integrations" module (module_flags.integrations)
with two tables:
- `integrations`: one row per third-party connector a tenant has
  configured (WhatsApp/SMS provider, Google Calendar, Slack, generic
  payment/CRM connector, ...). `config` is a small jsonb blob of
  non-secret settings (phone number, calendar id, channel name, ...).
  A unique (tenant_id, provider) index makes "configure" an upsert.
- `webhooks`: outgoing webhook subscriptions a tenant can register so
  their own systems get notified on events (appointment.created,
  invoice.paid, patient.created, ...). Mirrors the existing api_keys
  tenant-scoping pattern (20260729_api_keys_tenant_scoping): RLS checks
  tenant membership AND tenant_module_enabled(tenant_id, 'integrations'),
  with a super-admin bypass.

Enabled by default for professional/business/enterprise (not starter),
matching how the other paid-tier modules (lab, pharmacy, ...) are seeded.
*/

-- ============================================================
-- 1. Fix: 'api' flag was advertised but never actually granted
-- ============================================================
UPDATE subscription_plans SET module_flags = module_flags || '{"api": true}'::jsonb
  WHERE code IN ('business', 'enterprise');

-- ============================================================
-- 2. New module flag: integrations
-- ============================================================
UPDATE subscription_plans SET module_flags = module_flags || '{"integrations": false}'::jsonb
  WHERE code = 'starter';
UPDATE subscription_plans SET module_flags = module_flags || '{"integrations": true}'::jsonb
  WHERE code IN ('professional', 'business', 'enterprise');

-- ============================================================
-- 3. integrations table
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('whatsapp', 'sms', 'google_calendar', 'slack', 'flutterwave', 'webhook_generic')),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS integrations_tenant_provider_uidx ON integrations(tenant_id, provider);
CREATE INDEX IF NOT EXISTS integrations_tenant_idx ON integrations(tenant_id);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations_select" ON integrations;
CREATE POLICY "integrations_select" ON integrations FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = integrations.tenant_id)
    AND tenant_module_enabled(integrations.tenant_id, 'integrations')
  )
);
DROP POLICY IF EXISTS "integrations_insert" ON integrations;
CREATE POLICY "integrations_insert" ON integrations FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = integrations.tenant_id)
    AND tenant_module_enabled(integrations.tenant_id, 'integrations')
  )
);
DROP POLICY IF EXISTS "integrations_update" ON integrations;
CREATE POLICY "integrations_update" ON integrations FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = integrations.tenant_id)
) WITH CHECK (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = integrations.tenant_id)
);
DROP POLICY IF EXISTS "integrations_delete" ON integrations;
CREATE POLICY "integrations_delete" ON integrations FOR DELETE TO authenticated USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = integrations.tenant_id)
);

-- ============================================================
-- 4. webhooks table
-- ============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  event text NOT NULL DEFAULT 'all',
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhooks_tenant_idx ON webhooks(tenant_id);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhooks_select" ON webhooks;
CREATE POLICY "webhooks_select" ON webhooks FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = webhooks.tenant_id)
    AND tenant_module_enabled(webhooks.tenant_id, 'integrations')
  )
);
DROP POLICY IF EXISTS "webhooks_insert" ON webhooks;
CREATE POLICY "webhooks_insert" ON webhooks FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = webhooks.tenant_id)
    AND tenant_module_enabled(webhooks.tenant_id, 'integrations')
  )
);
DROP POLICY IF EXISTS "webhooks_update" ON webhooks;
CREATE POLICY "webhooks_update" ON webhooks FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = webhooks.tenant_id)
) WITH CHECK (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = webhooks.tenant_id)
);
DROP POLICY IF EXISTS "webhooks_delete" ON webhooks;
CREATE POLICY "webhooks_delete" ON webhooks FOR DELETE TO authenticated USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = webhooks.tenant_id)
);
