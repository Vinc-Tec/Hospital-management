/*
  Bug found on audit: nothing in the database stopped patient_payments
  from collecting more than an invoice's total. The cash desk UI checks
  this client-side, but two concurrent submissions for the same invoice
  (two cash desk terminals, or a double-click) could both read the same
  "amount still owed" before either insert lands, and both pass their
  own check -- together overpaying the invoice. Locks the invoice row
  for the duration of the check so concurrent inserts are serialized,
  not just individually validated against a stale balance.
*/

CREATE OR REPLACE FUNCTION prevent_invoice_overpayment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12,2);
  v_collected numeric(12,2);
BEGIN
  SELECT total INTO v_total FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF v_total IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_collected FROM patient_payments WHERE invoice_id = NEW.invoice_id;

  IF v_collected + NEW.amount > v_total + 0.01 THEN
    RAISE EXCEPTION 'payment_exceeds_invoice_balance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invoice_overpayment ON patient_payments;
CREATE TRIGGER trg_prevent_invoice_overpayment
BEFORE INSERT ON patient_payments
FOR EACH ROW EXECUTE FUNCTION prevent_invoice_overpayment();
