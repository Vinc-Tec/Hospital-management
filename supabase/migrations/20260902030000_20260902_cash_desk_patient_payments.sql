/*
  La Caisse -- the actual front-desk cash register, not just an invoice
  status dropdown.

  Until now, `invoices.status` was a free-standing enum a staff member
  could set to 'paid' by hand with no record of how much was actually
  collected, by whom, through which method, or when -- there was no
  cashier workflow at all, just a label. This adds the real transaction
  ledger every hospital cash desk needs:

    - patient_payments: one row per amount actually collected against
      an invoice (method, reference, who received it, cash tendered /
      change given for cash transactions). Payments are never deleted
      or edited once recorded -- a mistake is corrected with a
      negative-amount reversal row, exactly like a real till journal,
      so the audit trail always reconciles.

    - invoices.status is now kept in sync automatically by a trigger
      that sums patient_payments for the invoice: 0 collected -> unpaid,
      something but less than the total -> partial, total or more ->
      paid. A second trigger blocks staff from hand-setting status to
      'paid'/'partial' directly -- only the reconciliation trigger
      (via a session-local flag it sets around its own UPDATE) or
      explicitly marking an invoice 'cancelled'/'refunded' is allowed.
      This is the actual gap being closed: a dropdown that let anyone
      mark an invoice paid with no money ever recorded.

    - cash_sessions: an optional till session (open with a starting
      float, close with a counted total) so a cashier's shift can be
      reconciled against what the system says was collected during it.
*/

-- ---------- patient_payments ----------
CREATE TABLE IF NOT EXISTS patient_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'card', 'mobile_money', 'bank_transfer', 'insurance', 'other')),
  amount_tendered numeric(12,2),
  change_given numeric(12,2),
  reference text,
  cash_session_id uuid,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pp_tenant_idx ON patient_payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pp_invoice_idx ON patient_payments(invoice_id);

ALTER TABLE patient_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select" ON patient_payments;
CREATE POLICY "pp_select" ON patient_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.tenant_id = patient_payments.tenant_id));

DROP POLICY IF EXISTS "pp_insert" ON patient_payments;
CREATE POLICY "pp_insert" ON patient_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.tenant_id = patient_payments.tenant_id));

-- Deliberately no UPDATE/DELETE policy: a recorded cash transaction is
-- never edited or removed, only reversed with a new, negative-amount
-- row referencing the same invoice -- the trigger below treats the sum
-- of all rows (positive and negative) as truth.

-- ---------- cash_sessions ----------
CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by_name text,
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_name text,
  closing_count numeric(12,2),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes text
);
CREATE INDEX IF NOT EXISTS cs_tenant_idx ON cash_sessions(tenant_id, opened_at DESC);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cs_select" ON cash_sessions;
CREATE POLICY "cs_select" ON cash_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.tenant_id = cash_sessions.tenant_id));

DROP POLICY IF EXISTS "cs_insert" ON cash_sessions;
CREATE POLICY "cs_insert" ON cash_sessions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.tenant_id = cash_sessions.tenant_id));

DROP POLICY IF EXISTS "cs_update" ON cash_sessions;
CREATE POLICY "cs_update" ON cash_sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.tenant_id = cash_sessions.tenant_id))
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.tenant_id = cash_sessions.tenant_id));

ALTER TABLE patient_payments ADD CONSTRAINT patient_payments_cash_session_fkey
  FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL;

-- ---------- reconcile invoices.status to what was actually collected ----------
CREATE OR REPLACE FUNCTION sync_invoice_status_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_total numeric(12,2);
  v_collected numeric(12,2);
BEGIN
  SELECT total INTO v_total FROM invoices WHERE id = v_invoice_id;
  IF v_total IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_collected FROM patient_payments WHERE invoice_id = v_invoice_id;

  -- Flags this specific UPDATE as the trusted, system-driven path so
  -- the guard trigger on invoices (below) lets it through.
  PERFORM set_config('app.allow_status_sync', 'on', true);
  UPDATE invoices
  SET status = CASE
    WHEN v_collected <= 0 THEN 'unpaid'
    WHEN v_collected >= v_total THEN 'paid'
    ELSE 'partial'
  END
  WHERE id = v_invoice_id AND status NOT IN ('cancelled', 'refunded');
  PERFORM set_config('app.allow_status_sync', 'off', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_status ON patient_payments;
CREATE TRIGGER trg_sync_invoice_status
AFTER INSERT OR UPDATE OR DELETE ON patient_payments
FOR EACH ROW EXECUTE FUNCTION sync_invoice_status_from_payments();

-- ---------- block hand-setting status='paid'/'partial' outside the trigger above ----------
CREATE OR REPLACE FUNCTION guard_invoice_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('paid', 'partial')
     AND NOT (current_setting('app.allow_status_sync', true) = 'on') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invoice_status ON invoices;
CREATE TRIGGER trg_guard_invoice_status
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION guard_invoice_status_update();
