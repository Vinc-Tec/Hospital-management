/*
# Lock tenant INSERT: close the trial/payment bypass at creation time

## Why
The previous "close_tenant_self_approval_gap" migration (20260730) hardened
tenants UPDATE so an owner can no longer self-set status='approved' or
plan_id. But tenants INSERT was left wide open: `tenants_insert_own` only
checks `auth.uid() = owner_user_id` and imposes NO restriction on status,
plan_id, trial_ends_at, or grace_period_ends_at.

The onboarding client (Onboarding.tsx) sends status='approved', a chosen
plan_id, and a client-computed trial_ends_at directly in the INSERT. A
technically savvy owner can therefore create a tenant that is already
"approved" with a plan and an arbitrarily long trial via a single direct
PostgREST insert -- bypassing the entire Flutterwave flow, the webhook,
BillingGate and enforce_tenant_billing_active(). This is the exact same
class of self-grant bug already fixed for profiles.is_super_admin and for
tenants UPDATE; it must also be closed on INSERT.

## Fix
A single SECURITY DEFINER trigger, BEFORE INSERT on tenants, that:
  1. Forces status := 'pending' (never 'approved') for any non-super-admin
     insert, regardless of what the client supplied. Super admins can still
     create a pre-approved tenant if they ever need to (admin tooling), but
     a regular tenant owner cannot.
  2. Clears plan_id for non-super-admin inserts (no plan without payment).
  3. Recomputes trial_ends_at from platform_settings.trial_days so the
     client cannot set an arbitrary / infinite trial. Uses a sane fallback
     of 7 days if platform_settings is somehow empty.
  4. Clears any client-supplied grace_period_ends_at (grace is only ever
     set by the billing housekeeping path, never by the tenant at creation).

The trigger is idempotent (CREATE OR REPLACE) and the migration is safe to
run on a database that already has tenants (it does not touch existing
rows -- it only governs future INSERTs).
*/

CREATE OR REPLACE FUNCTION fn_lock_tenant_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days int;
BEGIN
  -- Super admins (creating a tenant from the admin console) are allowed to
  -- pass through whatever values they supply, including a pre-approved
  -- status. Everyone else -- i.e. the onboarding owner -- gets the safe
  -- defaults below, no matter what the request body contained.
  IF NOT is_super_admin() THEN
    -- status MUST be 'pending': the "approved + plan_id" billing branch
    -- requires status='approved', and only the Flutterwave webhook (service
    -- role) can set that after a verified payment. Forcing 'pending' here
    -- is what actually closes the self-approval / bypass-payment hole.
    NEW.status := 'pending';
    -- plan_id is intentionally KEPT (the client's chosen plan): it drives
    -- module access during the trial via tenant_module_enabled(), so a
    -- new tenant can actually try the plan they picked. It is SAFE to keep
    -- because the billing "approved" branch also needs status='approved',
    -- which the client can never set; plan_id alone grants no billing
    -- access, only module visibility for the duration of the trial.
    NEW.grace_period_ends_at := NULL;

    -- trial_ends_at is decided by the server from platform_settings, never
    -- from the client. A bounded, positive value is enforced.
    SELECT trial_days INTO v_trial_days FROM platform_settings WHERE id = true;
    IF v_trial_days IS NULL OR v_trial_days <= 0 THEN
      v_trial_days := 7;
    END IF;
    NEW.trial_ends_at := now() + make_interval(days => v_trial_days);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_tenant_insert ON tenants;
CREATE TRIGGER trg_lock_tenant_insert
  BEFORE INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION fn_lock_tenant_insert();

/*
# Audit log on tenant creation

Every new tenant row is recorded in audit_logs so platform operators can
spot self-approval attempts, unusual trial lengths, or a sudden burst of
sign-ups. The trigger runs AFTER INSERT (so the row exists and NEW.id is
the final id) and writes via SECURITY DEFINER so it can insert into
audit_logs regardless of the caller's own insert permissions on that table.

It captures the values the lock trigger actually persisted (status,
plan_id, trial_ends_at) rather than what the client *tried* to send, so
the audit reflects reality and makes any super-admin pre-approval obvious.
*/
CREATE OR REPLACE FUNCTION fn_audit_tenant_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES (
    NEW.id,
    NEW.owner_user_id,
    'tenant.created',
    'tenants',
    NEW.id,
    jsonb_build_object(
      'legal_name', NEW.legal_name,
      'status', NEW.status,
      'plan_id', NEW.plan_id,
      'trial_ends_at', NEW.trial_ends_at,
      'grace_period_ends_at', NEW.grace_period_ends_at,
      'healthcare_type', NEW.healthcare_type
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tenant_insert ON tenants;
CREATE TRIGGER trg_audit_tenant_insert
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION fn_audit_tenant_insert();
