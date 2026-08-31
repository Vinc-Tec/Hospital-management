/*
# RLS performance: last remaining auth.jwt() call

The previous two migrations wrapped every flagged auth.uid() call, but
subscription_events.se_insert also calls auth.jwt() directly (to check
for the service_role), which the advisor flags the same way. This was
the single remaining auth_rls_initplan finding after the prior two
migrations (139 -> 0). Logic unchanged, only the query plan differs.

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

DROP POLICY IF EXISTS "se_insert" ON subscription_events;
CREATE POLICY "se_insert" ON subscription_events FOR INSERT TO authenticated
  WITH CHECK ((is_super_admin() OR COALESCE((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text), false) OR ((event_type = 'subscription_created'::subscription_event_type_enum) AND (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = subscription_events.tenant_id)))))));
