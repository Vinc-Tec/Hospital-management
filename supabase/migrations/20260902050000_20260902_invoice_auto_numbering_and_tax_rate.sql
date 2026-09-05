/*
  Two real billing gaps closed here:

  1. tenants.tax_rate -- until now there was nowhere to set a default
     tax rate for an institution, so every invoice's tax amount had to
     be typed in by hand. Set once at onboarding, applied automatically
     to new invoices client-side (subtotal * tax_rate / 100), still
     editable per-invoice for the rare exception.

  2. Automatic, sequential invoice numbers. invoice_number was a
     required free-text field -- easy to duplicate, skip, or leave
     inconsistent between staff. This adds a per-tenant, per-year
     counter and a trigger that fills invoice_number in automatically
     (format INV-<year>-<0000>) whenever it's left blank, so manual
     entry is no longer required and numbers can't collide.
*/

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tenant_invoice_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);
ALTER TABLE tenant_invoice_counters ENABLE ROW LEVEL SECURITY;
-- No policies granted on purpose: this table is only ever touched by
-- the SECURITY DEFINER trigger function below, never queried directly
-- by the app, so it needs no client-facing access at all.

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM COALESCE(NEW.issue_date, CURRENT_DATE))::int;
  v_next int;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND btrim(NEW.invoice_number) != '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO tenant_invoice_counters (tenant_id, year, last_number)
  VALUES (NEW.tenant_id, v_year, 1)
  ON CONFLICT (tenant_id, year)
  DO UPDATE SET last_number = tenant_invoice_counters.last_number + 1
  RETURNING last_number INTO v_next;

  NEW.invoice_number := 'INV-' || v_year || '-' || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_invoice_number ON invoices;
CREATE TRIGGER trg_generate_invoice_number
BEFORE INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();
