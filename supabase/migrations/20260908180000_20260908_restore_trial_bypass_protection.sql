/*
# CRITICAL: restore the trial/subscription bypass protection (regression)

## Confirmed regression, not a new finding
20260805_close_trial_extension_bypass.sql fixed a confirmed live
incident: a tenant owner could call
`supabase.from('tenants').update({ trial_ends_at: '2099-01-01' })`
directly from the browser and extend their own trial forever, for
free, bypassing tenant_billing_active() entirely (which treats a
future trial_ends_at as sufficient for full access). The fix embedded a
"new value must equal old value" self-referencing subquery for
status/plan_id/trial_ends_at/grace_period_ends_at inside the UPDATE
policy's WITH CHECK.

The very next day, 20260806_consolidated_recursion_fix.sql (fixing an
unrelated "infinite recursion in policy for relation tenants" crash)
replaced that same policy with a simpler version that dropped the
column-lock entirely -- almost certainly because the self-referencing
subquery re-triggered this table's own RLS and contributed to the
recursion being debugged, and the fastest way to stop the crash was to
simplify the policy rather than find a recursion-safe way to keep the
protection. 20260830's performance pass then carried that same
simplified, unprotected policy forward.

Net effect: the exact bypass fixed on 2026-08-05 has been silently
live again since 2026-08-06 -- over a month. Any tenant owner can
currently self-extend their trial or self-approve their own
subscription for free via a direct API call, with nothing to stop it.

## Fix: a BEFORE UPDATE trigger instead of an RLS subquery
A trigger reads OLD/NEW directly from Postgres's own row versions --
no subquery against `tenants` is needed at all, so there is nothing
left to recurse into. This is strictly more robust than embedding the
check in RLS: it holds regardless of how tenants_update_own is written
today or refactored in the future, closing off exactly the failure
mode that caused this regression in the first place.

Only is_super_admin() (manual approval) or the service role (payment
webhooks, which bypass RLS/triggers-via-service-key context but still
run through auth.role() = 'service_role' here) may change status,
plan_id, trial_ends_at, or grace_period_ends_at. Everyone else keeps
full ability to update their tenant's business details (name, address,
tax_rate, etc.) -- only these four billing-control fields are locked.
*/

CREATE OR REPLACE FUNCTION protect_tenant_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_super_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.grace_period_ends_at IS DISTINCT FROM OLD.grace_period_ends_at THEN
    RAISE EXCEPTION 'billing_fields_protected';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_tenant_billing_fields ON tenants;
CREATE TRIGGER trg_protect_tenant_billing_fields
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION protect_tenant_billing_fields();
