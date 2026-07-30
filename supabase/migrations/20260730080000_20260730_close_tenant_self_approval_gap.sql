/*
# Close the tenant self-approval gap before wiring real payment

## Why
tenants_update_own let the owner update ANY column on their own tenant
row, including `status` and `plan_id` -- the exact two fields that decide
whether the tenant has paid access. This is what the current
handleSubscribe() exploits (it just sets status='approved' + plan_id
directly). Before wiring real Flutterwave payment, this must be closed:
otherwise a technically savvy tenant owner could keep granting themselves
access for free via a direct API call, bypassing the payment gateway
entirely, and the whole payment integration would be security theater --
the exact same class of bug already found and fixed for
profiles.is_super_admin in the very first security-hardening PR.

## Fix
Owners can still update their own tenant's business details (name,
address, contact info, branding, etc.) freely. Only `status` and
`plan_id` now require the value to stay unchanged unless the caller is a
super admin -- those two fields can only be set by an admin action or by
the Flutterwave webhook, which runs with the service role and therefore
bypasses RLS entirely (unaffected by this policy).
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
    )
  );
