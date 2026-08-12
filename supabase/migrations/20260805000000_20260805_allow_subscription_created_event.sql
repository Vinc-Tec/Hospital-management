/*
 * Allow tenant members to log only the 'subscription_created' audit event.
 *
 * ## Why
 * subscription_events.se_insert requires is_super_admin(), so the
 * Onboarding flow's attempt to record a 'subscription_created' event as
 * the new tenant owner is silently rejected by RLS -- the audit trail for
 * tenant creation is therefore never written.
 *
 * ## Fix
 * Replace the blanket super-admin-only INSERT policy with two branches:
 *   1. super admins / service role can insert any event (webhook logs
 *      'payment_succeeded', housekeeping logs 'grace_period_expired', etc.);
 *   2. a tenant member may insert ONLY event_type = 'subscription_created'
 *      for their own tenant.
 *
 * 'subscription_created' is purely informational (it records that onboarding
 * chose a plan) and grants no billing access -- billing activation still
 * requires tenants.status = 'approved', which only the webhook/service role
 * can set. So allowing this one event type from the owner is safe, while all
 * security-sensitive event types stay locked to super_admin/service_role.
 *
 * UPDATE/DELETE remain disabled (append-only) -- unchanged.
 */

DROP POLICY IF EXISTS "se_insert" ON subscription_events;
CREATE POLICY "se_insert" ON subscription_events FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR COALESCE(auth.jwt() ->> 'role' = 'service_role', false)
  OR (
    event_type = 'subscription_created'
    AND EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = subscription_events.tenant_id
    )
  )
);
