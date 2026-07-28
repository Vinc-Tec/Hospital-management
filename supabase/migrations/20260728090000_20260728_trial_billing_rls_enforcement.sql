/*
# RLS-level enforcement of trial/subscription expiry (defense in depth)

## Why
BillingGate (React) already blocks the whole app UI once a tenant's trial
has expired past its grace period and it has no active plan. That is a
real, working screen -- but it is enforced only in the browser. Nothing
in the database itself checked billing status before this migration, so
a tenant's own technically sophisticated user could keep reading and
writing patients/appointments/doctors/invoices via a direct Supabase API
call even after the trial (and grace period) had fully expired.

This mirrors the exact logic already used by useAccessState() in
Billing.tsx:
  - active if status = 'approved' AND a plan_id is set, OR
  - active if still within trial_ends_at, OR
  - active if within the grace period after trial (explicit
    grace_period_ends_at, or trial_ends_at + 3 days by default)
  - otherwise blocked

Super admins always bypass this, same as everywhere else.

IMPORTANT: this still does not make any payment "active" -- there is no
real payment gateway wired up yet (pending a live PSP account). What
this migration guarantees is that once a trial genuinely expires, access
is actually cut off at the database level, not just hidden in the UI --
so when real payment is eventually connected, "customer pays -> access
resumes" will be a real, enforced state change, not just cosmetic.
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
        (t.status = 'approved' AND t.plan_id IS NOT NULL)
        OR t.trial_ends_at > now()
        OR COALESCE(t.grace_period_ends_at, t.trial_ends_at + interval '3 days') > now()
       FROM tenants t
       WHERE t.id = p_tenant_id),
      false
    );
$$;

-- Fold the billing check into the existing plan-module gate so every
-- table already using tenant_module_enabled() gets this for free.
CREATE OR REPLACE FUNCTION tenant_module_enabled(p_tenant_id uuid, p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR (
      tenant_billing_active(p_tenant_id)
      AND COALESCE(
        (SELECT (sp.module_flags ->> p_module)::boolean
         FROM tenants t
         JOIN subscription_plans sp ON sp.id = t.plan_id
         WHERE t.id = p_tenant_id),
        false
      )
    );
$$;

-- ---------- core tables included in every plan (were never module-gated) ----------
DROP POLICY IF EXISTS "patients_select" ON patients;
CREATE POLICY "patients_select" ON patients FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  AND tenant_billing_active(patients.tenant_id)
);
DROP POLICY IF EXISTS "patients_insert" ON patients;
CREATE POLICY "patients_insert" ON patients FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  AND tenant_billing_active(patients.tenant_id)
);
DROP POLICY IF EXISTS "patients_update" ON patients;
CREATE POLICY "patients_update" ON patients FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  AND tenant_billing_active(patients.tenant_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  AND tenant_billing_active(patients.tenant_id)
);
DROP POLICY IF EXISTS "patients_delete" ON patients;
CREATE POLICY "patients_delete" ON patients FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patients.tenant_id)
  AND tenant_billing_active(patients.tenant_id)
);

DROP POLICY IF EXISTS "doctors_select" ON doctors;
CREATE POLICY "doctors_select" ON doctors FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
  AND tenant_billing_active(doctors.tenant_id)
);
DROP POLICY IF EXISTS "doctors_insert" ON doctors;
CREATE POLICY "doctors_insert" ON doctors FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
  AND tenant_billing_active(doctors.tenant_id)
);
DROP POLICY IF EXISTS "doctors_update" ON doctors;
CREATE POLICY "doctors_update" ON doctors FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
  AND tenant_billing_active(doctors.tenant_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
  AND tenant_billing_active(doctors.tenant_id)
);
DROP POLICY IF EXISTS "doctors_delete" ON doctors;
CREATE POLICY "doctors_delete" ON doctors FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = doctors.tenant_id)
  AND tenant_billing_active(doctors.tenant_id)
);

DROP POLICY IF EXISTS "appts_select" ON appointments;
CREATE POLICY "appts_select" ON appointments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
  AND tenant_billing_active(appointments.tenant_id)
);
DROP POLICY IF EXISTS "appts_insert" ON appointments;
CREATE POLICY "appts_insert" ON appointments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
  AND tenant_billing_active(appointments.tenant_id)
);
DROP POLICY IF EXISTS "appts_update" ON appointments;
CREATE POLICY "appts_update" ON appointments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
  AND tenant_billing_active(appointments.tenant_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
  AND tenant_billing_active(appointments.tenant_id)
);
DROP POLICY IF EXISTS "appts_delete" ON appointments;
CREATE POLICY "appts_delete" ON appointments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = appointments.tenant_id)
  AND tenant_billing_active(appointments.tenant_id)
);

DROP POLICY IF EXISTS "inv_select" ON invoices;
CREATE POLICY "inv_select" ON invoices FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
  AND tenant_billing_active(invoices.tenant_id)
);
DROP POLICY IF EXISTS "inv_insert" ON invoices;
CREATE POLICY "inv_insert" ON invoices FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
  AND tenant_billing_active(invoices.tenant_id)
);
DROP POLICY IF EXISTS "inv_update" ON invoices;
CREATE POLICY "inv_update" ON invoices FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
  AND tenant_billing_active(invoices.tenant_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
  AND tenant_billing_active(invoices.tenant_id)
);
DROP POLICY IF EXISTS "inv_delete" ON invoices;
CREATE POLICY "inv_delete" ON invoices FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = invoices.tenant_id)
  AND tenant_billing_active(invoices.tenant_id)
);

-- NOTE: tenants, tenant_memberships, profiles, branches, and
-- subscription_plans are deliberately NOT gated here -- the billing
-- screen itself (and navigation) needs to keep reading the tenant's own
-- row and membership to know it's expired and show the correct screen.
-- Gating those would create a chicken-and-egg lockout.
