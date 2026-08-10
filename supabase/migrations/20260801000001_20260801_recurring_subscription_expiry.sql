/*
# Recurring subscription expiry enforcement

## Why
Before this migration, tenant_billing_active() granted "approved + plan_id"
access permanently once a single payment was confirmed -- it never looked
at tenant_subscriptions.end_date / next_billing_date. A tenant that paid
once kept access forever, even after cancelling or stopping payment, so
"pay to continue" was only ever true for the first billing cycle.

## Fix
1. Rewrite tenant_billing_active() so the "paid" branch
   (status='approved' AND plan_id IS NOT NULL) is active only when:
     - the tenant has at least one tenant_subscriptions row, AND one of
       them is status='active' with a matching plan_id whose
       COALESCE(end_date, next_billing_date) is today or later; OR
     - the tenant has NO tenant_subscriptions row at all -- this is a
       super-admin-managed / legacy account (the INSERT lock elsewhere
       guarantees no NEW tenant can reach status='approved' + plan_id
       without going through the webhook, which always creates a
       subscription). This preserves the admin "approve + assign plan"
       flow without re-opening the self-approval hole.
   Trial and grace windows are unchanged.
2. Add fn_billing_housekeeping() that lapses active subscriptions past
   their next_billing_date/end_date to 'past_due', and (once the trial +
   grace window is also fully elapsed) suspends a tenant ONLY when it
   actually had a subscription that has now lapsed -- never a never-paid
   admin/legacy account. Safe to call from a scheduled (cron) Edge
   Function; idempotent.
3. Keep super-admin bypass.

This migration is idempotent (CREATE OR REPLACE) and does not alter data.
*/

CREATE OR REPLACE FUNCTION tenant_billing_active(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR COALESCE(
      (SELECT
        (
          (
            t.status = 'approved'
            AND t.plan_id IS NOT NULL
            AND (
              -- No subscription row at all: a super-admin-managed or
              -- legacy account (the INSERT lock guarantees new self-
              -- approvals can't reach here). Keep access.
              NOT EXISTS (
                SELECT 1 FROM tenant_subscriptions ts2 WHERE ts2.tenant_id = t.id
              )
              OR EXISTS (
                SELECT 1
                FROM tenant_subscriptions ts
                WHERE ts.tenant_id = t.id
                  AND ts.status = 'active'
                  AND ts.plan_id = t.plan_id
                  AND COALESCE(ts.end_date, ts.next_billing_date) IS NOT NULL
                  AND COALESCE(ts.end_date, ts.next_billing_date)::date >= current_date
              )
            )
          )
          OR t.trial_ends_at > now()
          OR COALESCE(t.grace_period_ends_at, t.trial_ends_at + interval '3 days') > now()
        )
       FROM tenants t
       WHERE t.id = p_tenant_id),
      false
    );
$$;

-- Billing housekeeping: call periodically (cron / scheduled Edge Function).
-- Marks active subscriptions past their next_billing_date/end_date as
-- past_due, and (once the grace window elapses) suspends a tenant that
-- actually had a paid subscription which has now lapsed. It deliberately
-- does NOT touch tenants that never had a subscription row (admin-managed
-- / legacy accounts) -- those are governed manually by super admins.
-- Idempotent and safe to run repeatedly.
CREATE OR REPLACE FUNCTION fn_billing_housekeeping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grace_days int := 3;
BEGIN
  SELECT grace_days INTO v_grace_days FROM grace_period_config WHERE tenant_id IS NULL;
  IF v_grace_days IS NULL OR v_grace_days <= 0 THEN v_grace_days := 3; END IF;

  -- 1. Lapse active subscriptions whose billing date is in the past.
  UPDATE tenant_subscriptions ts
  SET status = 'past_due'
  WHERE ts.status = 'active'
    AND COALESCE(ts.end_date, ts.next_billing_date) IS NOT NULL
    AND COALESCE(ts.end_date, ts.next_billing_date)::date < current_date;

  -- 2. Suspend tenants that DID have a paid subscription now lapsed, and
  --    whose trial + grace window is also fully elapsed. This makes the
  --    UI's BillingGate + the write trigger correctly enforce "must pay".
  UPDATE tenants t
  SET status = 'suspended'
  WHERE t.status = 'approved'
    AND t.plan_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id)
    AND NOT EXISTS (
      SELECT 1
      FROM tenant_subscriptions ts
      WHERE ts.tenant_id = t.id
        AND ts.status = 'active'
        AND COALESCE(ts.end_date, ts.next_billing_date) IS NOT NULL
        AND COALESCE(ts.end_date, ts.next_billing_date)::date >= current_date
    )
    AND t.trial_ends_at <= now()
    AND COALESCE(t.grace_period_ends_at, t.trial_ends_at + make_interval(days => v_grace_days)) <= now();
END;
$$;
