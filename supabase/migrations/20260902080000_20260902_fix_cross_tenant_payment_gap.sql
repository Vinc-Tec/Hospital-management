/*
  Critical cross-tenant integrity gap, found while stress-testing the
  cash desk against a real Postgres instance (not just reasoning about
  the SQL): the RLS policy "pp_insert" on patient_payments only checks
  that the caller belongs to the `tenant_id` value on the new row --
  it never checks that the `invoice_id` on that same row actually
  belongs to that tenant. A crafted request with tenant_id = <your own
  tenant> but invoice_id = <someone else's invoice> passed RLS cleanly
  and, through the reconciliation trigger, marked a completely
  different hospital's invoice as paid. Reproduced and confirmed
  fixed against a real database before writing this migration:
  the exploit now raises an exception and the legitimate,
  same-tenant case is unaffected.

  Fixed with a BEFORE INSERT trigger rather than an RLS policy change,
  since this needs to hold even for service-role/backend writes, not
  just requests running under a user's own RLS context.
*/

CREATE OR REPLACE FUNCTION validate_patient_payment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE id = NEW.invoice_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'patient_payments.invoice_id does not belong to patient_payments.tenant_id';
  END IF;
  IF NEW.cash_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cash_sessions WHERE id = NEW.cash_session_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'patient_payments.cash_session_id does not belong to patient_payments.tenant_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_patient_payment_tenant ON patient_payments;
CREATE TRIGGER trg_validate_patient_payment_tenant
BEFORE INSERT ON patient_payments
FOR EACH ROW EXECUTE FUNCTION validate_patient_payment_tenant();
