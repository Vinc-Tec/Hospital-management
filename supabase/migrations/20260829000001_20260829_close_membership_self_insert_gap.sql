/*
# CRITICAL: close a cross-tenant self-enrollment gap

memberships_insert's WITH CHECK was:
  (user_id = auth.uid()) OR is_tenant_owner(tenant_id) OR is_super_admin()
The first clause checked only that the new row's user_id matches the
caller -- it never checked which tenant_id they were inserting into.
Any authenticated user could run:
  INSERT INTO tenant_memberships (tenant_id, user_id, role, permissions)
  VALUES ('<any other tenant''s id>', auth.uid(), 'admin', '{}')
and grant themselves membership (and, via role/permissions, elevated
access) in ANY tenant on the platform -- a complete break of
multi-tenant isolation, since every clinical table's RLS policy
ultimately checks "is this user a member of this tenant" via exactly
this table.

The only legitimate self-insert case is onboarding: a user who just
created their own tenant (src/pages/Onboarding.tsx) immediately adds
themselves as its first member. That case is already fully covered by
is_tenant_owner(tenant_id), since tenants_insert_own requires
owner_user_id = auth.uid() at tenant-creation time. The user_id =
auth.uid() clause added no legitimate capability -- only the hole.
(Team invites go through the invite-team-member Edge Function, which
uses the service role and is unaffected by this policy either way.)

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

DROP POLICY IF EXISTS "memberships_insert" ON tenant_memberships;
CREATE POLICY "memberships_insert" ON tenant_memberships FOR INSERT
  TO authenticated WITH CHECK (
    is_tenant_owner(tenant_memberships.tenant_id)
    OR is_super_admin()
  );
