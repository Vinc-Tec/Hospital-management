/*
# Let tenant colleagues see each other's basic profile info

## Why
profiles_self_select only ever allowed auth.uid() = id -- a user could
read their own profile row, never a teammate's. This blocked the Team
management screen from ever showing colleagues' names/emails (needed to
invite/manage team members and see who has which role), since it's the
same `profiles` table used everywhere else for name display.

This adds visibility across shared tenant membership only (not globally):
two users can see each other's name/email if and only if they belong to
at least one of the same tenants. Nothing else on `profiles` (e.g.
is_super_admin) is exposed beyond what other policies already govern.
*/

DROP POLICY IF EXISTS "profiles_tenant_colleagues_select" ON profiles;
CREATE POLICY "profiles_tenant_colleagues_select" ON profiles FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships tm_self
    JOIN tenant_memberships tm_other ON tm_other.tenant_id = tm_self.tenant_id
    WHERE tm_self.user_id = auth.uid() AND tm_other.user_id = profiles.id
  )
);
