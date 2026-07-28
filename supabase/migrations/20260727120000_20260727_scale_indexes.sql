/*
# Scale-oriented indexes

## Why
Every single RLS policy in this schema (patients, appointments, medical
records, and the ~25 other tenant-scoped tables) resolves the same
predicate:

  EXISTS (SELECT 1 FROM tenant_memberships tm
          WHERE tm.user_id = auth.uid() AND tm.tenant_id = <table>.tenant_id)

At low volume, Postgres combines the two existing single-column indexes
(`memberships_user_idx`, `memberships_tenant_idx`) via a bitmap AND, which
is fine. At the scale this platform is aiming for (many institutions,
many staff members each), a single composite index matching the exact
predicate lets Postgres do this in one index scan instead of two combined
scans -- this is the single most-executed lookup in the entire
application (it runs on every row of every query, in every module), so it
is the highest-leverage index to get right.
*/

CREATE INDEX IF NOT EXISTS memberships_user_tenant_idx ON tenant_memberships(user_id, tenant_id);
