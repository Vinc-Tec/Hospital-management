/*
 * Block trial / grace-period extension by the tenant owner (payment bypass).
 *
 * ## The hole
 * tenants_update_own (migration 20260730080000) protects `status` and
 * `plan_id` from being changed by the owner, but does NOT protect
 * `trial_ends_at` or `grace_period_ends_at`. tenant_billing_active()
 * grants access while `trial_ends_at > now()` or while the grace period
 * is in the future. So an owner could simply UPDATE their own tenants
 * row and set trial_ends_at = now() + interval '10 years' via a direct
 * PostgREST call -- extending the trial forever and NEVER paying.
 *   This is the exact "bypass payment after trial expiration" risk.
 *
 * ## Fix
 * A BEFORE UPDATE SECURITY DEFINER trigger that, for any non-super-admin
 * caller, freezes the four billing-sensitive columns to their existing
 * (OLD) values, ignoring whatever the client tried to send:
 *   - status
 *   - plan_id
 *   - trial_ends_at
 *   - grace_period_ends_at
 *
 * Super admins and the service role (webhook) are unaffected and can
 * still set these legitimately. This is defense-in-depth alongside the
 * existing RLS WITH CHECK (which already locks status/plan_id).
 *
 * Idempotent (CREATE OR REPLACE). Does not touch existing rows.
 */

CREATE OR REPLACE FUNCTION fn_lock_tenant_billing_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow super admins and the service role (Flutterwave webhook, billing
  -- housekeeping) to set billing-sensitive columns. Everyone else -- i.e. the
  -- tenant owner -- has these frozen to their OLD values, so a trial or
  -- grace period can never be extended via a direct API call.
  IF NOT (is_super_admin() OR COALESCE(auth.jwt() ->> 'role' = 'service_role', false)) THEN
    NEW.status              := OLD.status;
    NEW.plan_id             := OLD.plan_id;
    NEW.trial_ends_at       := OLD.trial_ends_at;
    NEW.grace_period_ends_at := OLD.grace_period_ends_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_tenant_billing_cols ON tenants;
CREATE TRIGGER trg_lock_tenant_billing_cols
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION fn_lock_tenant_billing_cols();
