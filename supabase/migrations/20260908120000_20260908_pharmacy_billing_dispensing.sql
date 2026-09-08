/*
# Pharmacy <-> Billing coherence: real dispensing workflow

## Why
Prescriptions and pharmacy_items were two fully disconnected tables.
`prescriptions.medication` was free text (never a real stock item), a
prescription could be marked 'dispensed' without touching stock at all,
and invoices had no line items -- just a hand-typed subtotal/tax/total.
There was no way for dispensing a medication to actually reduce stock
or bill the patient. This migration makes that chain real.

## What this adds
1. `invoice_items`: real line items per invoice (description, quantity,
   unit_price, a generated `amount`, and `source_type`/`source_id` so a
   line can be traced back to what generated it -- a pharmacy dispense
   today, lab/radiology charges later). A trigger keeps the parent
   invoice's subtotal/tax/total in sync automatically whenever items are
   added, changed, or removed (tax computed from the tenant's
   `tax_rate`, same rate already used for manual invoices).
2. `prescriptions.pharmacy_item_id` (nullable): lets a prescription
   optionally point at a real `pharmacy_items` row instead of only free
   text, without breaking any existing prescription that only has
   `medication` text. `dispensed_at` / `dispensed_quantity` record what
   actually happened.
3. `dispense_prescription(p_prescription_id, p_quantity)`: the one
   function that does the real work, atomically:
   - checks the caller is a tenant member of the prescription's tenant
     and that both the pharmacy and invoices modules are enabled,
   - locks and decrements the linked pharmacy_items row (raises
     insufficient_stock if there isn't enough left -- no negative stock),
   - finds the patient's current unpaid/partial invoice, or opens a new
     one if none exists,
   - inserts the corresponding invoice_items row (which the trigger
     above then totals into the invoice automatically),
   - marks the prescription 'dispensed' with a timestamp and quantity.
   Runs SECURITY DEFINER so it can atomically touch three tables the
   calling role wouldn't otherwise have UPDATE rights across in one
   RLS-safe transaction, but re-checks tenant membership and module
   entitlements itself first -- it does not bypass the app's authority
   model, it enforces it in one place instead of relying on the client
   to make three separate correct calls in the right order.

## Security
RLS enabled on invoice_items with the same tenant-membership authority
used by every other table in this schema. dispense_prescription is
SECURITY DEFINER but performs its own membership + module_flags checks
before mutating anything (see function body) and is granted to
`authenticated` only.
*/

-- ============================================================
-- 1. invoice_items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'pharmacy', 'lab', 'radiology')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_items_tenant_idx ON invoice_items(tenant_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items(invoice_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT TO authenticated USING (
  is_super_admin() OR is_tenant_member(tenant_id)
);
DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT TO authenticated WITH CHECK (
  is_super_admin() OR (is_tenant_member(tenant_id) AND tenant_billing_active(tenant_id))
);
DROP POLICY IF EXISTS "invoice_items_update" ON invoice_items;
CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE TO authenticated USING (
  is_super_admin() OR (is_tenant_member(tenant_id) AND tenant_billing_active(tenant_id))
) WITH CHECK (
  is_super_admin() OR (is_tenant_member(tenant_id) AND tenant_billing_active(tenant_id))
);
DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;
CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE TO authenticated USING (
  is_super_admin() OR is_tenant_member(tenant_id)
);

-- ============================================================
-- 2. Keep invoices.subtotal/tax/total in sync with their items
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_subtotal numeric(12,2);
  v_tax_rate numeric(5,2);
  v_tax numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_subtotal FROM invoice_items WHERE invoice_id = v_invoice_id;
  SELECT t.tax_rate INTO v_tax_rate FROM invoices i JOIN tenants t ON t.id = i.tenant_id WHERE i.id = v_invoice_id;
  v_tax := round(v_subtotal * COALESCE(v_tax_rate, 0) / 100, 2);
  UPDATE invoices SET subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax WHERE id = v_invoice_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_invoice_totals ON invoice_items;
CREATE TRIGGER trg_recalc_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION recalc_invoice_totals();

-- ============================================================
-- 3. Link prescriptions to real stock + dispensing metadata
-- ============================================================
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_item_id uuid REFERENCES pharmacy_items(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dispensed_at timestamptz;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dispensed_quantity int;
CREATE INDEX IF NOT EXISTS rx_pharmacy_item_idx ON prescriptions(pharmacy_item_id);

-- ============================================================
-- 4. The dispensing function: stock decrement + invoice line item,
--    in one atomic, RLS-authorized transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION dispense_prescription(p_prescription_id uuid, p_quantity int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rx prescriptions%ROWTYPE;
  v_item pharmacy_items%ROWTYPE;
  v_invoice_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  SELECT * INTO v_rx FROM prescriptions WHERE id = p_prescription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'prescription_not_found';
  END IF;

  IF NOT (is_super_admin() OR is_tenant_member(v_rx.tenant_id)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT (tenant_module_enabled(v_rx.tenant_id, 'pharmacy') AND tenant_module_enabled(v_rx.tenant_id, 'invoices')) THEN
    RAISE EXCEPTION 'module_not_enabled';
  END IF;
  IF v_rx.status = 'dispensed' THEN
    RAISE EXCEPTION 'already_dispensed';
  END IF;
  IF v_rx.status = 'cancelled' THEN
    RAISE EXCEPTION 'prescription_cancelled';
  END IF;
  IF v_rx.pharmacy_item_id IS NULL THEN
    RAISE EXCEPTION 'no_pharmacy_item_linked';
  END IF;

  -- Lock the stock row so two simultaneous dispenses can't both pass
  -- the stock check and oversell the same batch.
  SELECT * INTO v_item FROM pharmacy_items WHERE id = v_rx.pharmacy_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pharmacy_item_not_found';
  END IF;
  IF v_item.quantity < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  UPDATE pharmacy_items SET quantity = quantity - p_quantity WHERE id = v_item.id;

  -- Reuse the patient's current unpaid/partial invoice if there is one
  -- (so a same-visit consultation + dispense lands on a single bill),
  -- otherwise open a new one.
  SELECT id INTO v_invoice_id FROM invoices
    WHERE tenant_id = v_rx.tenant_id AND patient_id = v_rx.patient_id AND status IN ('unpaid', 'partial')
    ORDER BY issue_date DESC LIMIT 1;

  IF v_invoice_id IS NULL THEN
    INSERT INTO invoices (tenant_id, patient_id, issue_date, subtotal, tax, total, status, notes)
    VALUES (v_rx.tenant_id, v_rx.patient_id, now(), 0, 0, 0, 'unpaid', 'Auto-generated from pharmacy dispensing')
    RETURNING id INTO v_invoice_id;
  END IF;

  INSERT INTO invoice_items (tenant_id, invoice_id, description, quantity, unit_price, source_type, source_id)
  VALUES (
    v_rx.tenant_id, v_invoice_id,
    v_item.name || COALESCE(' ' || v_item.strength, ''),
    p_quantity, v_item.unit_price, 'pharmacy', p_prescription_id
  );

  UPDATE prescriptions SET status = 'dispensed', dispensed_at = now(), dispensed_quantity = p_quantity
    WHERE id = p_prescription_id;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dispense_prescription(uuid, int) TO authenticated;
