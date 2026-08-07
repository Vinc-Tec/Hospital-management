/*
# CRITICAL: close the trial self-extension bypass

## Confirmed live incident
A tenant owner was found to have continued having full access to the
platform after their trial expired, without ever paying. Root cause: the
previous self-approval fix (close_tenant_self_approval_gap) only
protected `status` and `plan_id` from being changed by the tenant owner
via a direct API call -- it did NOT protect `trial_ends_at` or
`grace_period_ends_at`. Since tenant_billing_active() (and the frontend's
useAccessState()) both treat "trial_ends_at is still in the future" as
sufficient for active access, a tenant owner could simply call:

  supabase.from('tenants').update({ trial_ends_at: '2099-01-01' })

...directly via the API and extend their own trial indefinitely, for
free, forever. This is the exact bypass pattern originally flagged
before any of this project's security work began, and it was never
actually fully closed -- only the payment-approval fields were.

## Fix
Extend the same "tenant can update their own business details, but not
the fields that control paid access" policy to also cover
trial_ends_at and grace_period_ends_at. Only a super admin (e.g. via a
manual approval) or the Flutterwave webhook (service role, bypasses RLS
entirely) can now change any of these four fields:
status, plan_id, trial_ends_at, grace_period_ends_at.
*/

DROP POLICY IF EXISTS "tenants_update_own" ON tenants;
CREATE POLICY "tenants_update_own" ON tenants FOR UPDATE
  TO authenticated USING (
    auth.uid() = owner_user_id
    OR is_super_admin()
  ) WITH CHECK (
    is_super_admin()
    OR (
      auth.uid() = owner_user_id
      AND status = (SELECT t2.status FROM tenants t2 WHERE t2.id = tenants.id)
      AND plan_id IS NOT DISTINCT FROM (SELECT t2.plan_id FROM tenants t2 WHERE t2.id = tenants.id)
      AND trial_ends_at = (SELECT t2.trial_ends_at FROM tenants t2 WHERE t2.id = tenants.id)
      AND grace_period_ends_at IS NOT DISTINCT FROM (SELECT t2.grace_period_ends_at FROM tenants t2 WHERE t2.id = tenants.id)
    )
  );
