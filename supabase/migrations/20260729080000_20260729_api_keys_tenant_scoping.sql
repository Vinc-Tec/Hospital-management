/*
# Real per-tenant API keys (foundation for the public API)

## Why
api_keys had no tenant_id at all -- there was no way for a customer
institution to have its own scoped key, only a platform-wide table
manageable exclusively by super admins, with no relation to any specific
tenant. The Enterprise plan advertises API access as a tenant-facing
feature (module_flags.api), but nothing in the schema supported a tenant
actually owning a key.

Also: key_hash was being generated client-side via btoa() (reversible
base64 encoding, not a real hash) - see the corresponding code fix. This
migration doesn't change the column type (still text, holds a hex SHA-256
digest going forward), but the application-level fix now hashes properly.

## Design
- tenant_id nullable: NULL = a platform-level key (LiAfrik's own use,
  managed by super admins only, as before). Set = a tenant's own key,
  scoped to just that tenant's data through the API.
- A tenant can manage its own keys only if its plan includes the 'api'
  module (same tenant_module_enabled() gate used everywhere else).
- Super admins retain full access to all keys regardless of tenant_id.
*/

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON api_keys(tenant_id);

DROP POLICY IF EXISTS "ak_tenant_select" ON api_keys;
CREATE POLICY "ak_tenant_select" ON api_keys FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = api_keys.tenant_id)
    AND tenant_module_enabled(tenant_id, 'api')
  )
);

DROP POLICY IF EXISTS "ak_tenant_insert" ON api_keys;
CREATE POLICY "ak_tenant_insert" ON api_keys FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = api_keys.tenant_id)
    AND tenant_module_enabled(tenant_id, 'api')
  )
);

DROP POLICY IF EXISTS "ak_tenant_update" ON api_keys;
CREATE POLICY "ak_tenant_update" ON api_keys FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = api_keys.tenant_id)
  )
) WITH CHECK (
  is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = api_keys.tenant_id)
  )
);

DROP POLICY IF EXISTS "ak_tenant_delete" ON api_keys;
CREATE POLICY "ak_tenant_delete" ON api_keys FOR DELETE TO authenticated USING (
  is_super_admin()
  OR (
    tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = api_keys.tenant_id)
  )
);
