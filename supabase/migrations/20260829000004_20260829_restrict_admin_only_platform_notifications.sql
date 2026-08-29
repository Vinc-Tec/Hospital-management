/*
# Restrict admin-only platform notifications from other users

platform_notifications.target supports 'admins' (internal, admin-only
broadcasts -- see SuperAdmin.tsx's target selector: 'all', 'admins',
'tenants'), but pn_all_select had qual = true, readable by any
authenticated user regardless of target. Only the frontend
(src/pages/Dashboard.tsx) filtered to .in('target', ['all','tenants'])
client-side -- trivially bypassable by querying the table directly,
which would expose admin-only internal messages to any tenant user.

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

DROP POLICY IF EXISTS "pn_all_select" ON platform_notifications;
CREATE POLICY "pn_all_select" ON platform_notifications FOR SELECT TO authenticated USING (
  target <> 'admins' OR is_super_admin()
);
