/*
  This is the same bug as 20260902080000 (patient_payments), but found
  to be systemic rather than isolated to that one new table: every
  RLS INSERT/UPDATE policy in this schema checks that the caller
  belongs to a row's own tenant_id, but none of them check that the
  row's patient_id/doctor_id/invoice_id foreign keys actually point to
  a record belonging to that SAME tenant. Confirmed against a real
  Postgres instance (not just by reading the SQL) that, without this
  fix, a member of Tenant A could successfully insert e.g. an invoice
  or appointment with tenant_id = Tenant A but patient_id pointing at
  a Tenant B patient -- silently mixing one hospital's clinical data
  into another's records.

  Rather than hand-write a near-identical trigger function per table
  (error-prone at this many tables), this adds ONE generic, reusable
  trigger function driven by TG_ARGV -- tested directly against a real
  database for both the blocked cross-tenant case and the unaffected
  legitimate same-tenant case before writing this migration -- and
  attaches it to every FK column found to have this gap:

    appointments        (patient_id, doctor_id)
    medical_records     (patient_id, doctor_id)
    consultations       (patient_id, doctor_id)
    prescriptions       (patient_id, doctor_id)
    lab_orders          (patient_id, doctor_id)
    radiology_orders    (patient_id, doctor_id)
    beds                (patient_id)
    admissions          (patient_id, doctor_id)
    invoices            (patient_id)
    telemedicine_sessions (patient_id, doctor_id)
    emergency_cases     (patient_id)
    discharge_summaries (patient_id, doctor_id, admission_id -> admissions)
    surgeries           (patient_id, surgeon_id -> doctors)
    insurance_claims    (patient_id, invoice_id -> invoices)
    immunizations       (patient_id, administered_by -> doctors)

  A NULL foreign key (e.g. an emergency walk-in with no patient_id yet,
  or a doctor_id left unassigned) is allowed through unchanged -- this
  only rejects a FK that is set AND points across tenants.
*/

CREATE OR REPLACE FUNCTION validate_same_tenant_fk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_table text := TG_ARGV[0];
  fk_column text := TG_ARGV[1];
  fk_value uuid;
  ok boolean;
BEGIN
  EXECUTE format('SELECT ($1).%I', fk_column) INTO fk_value USING NEW;
  IF fk_value IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1 AND tenant_id = $2)', ref_table)
    INTO ok USING fk_value, NEW.tenant_id;
  IF NOT ok THEN
    RAISE EXCEPTION '% does not belong to the same tenant', fk_column;
  END IF;
  RETURN NEW;
END;
$$;

DO $do$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('appointments', 'patients', 'patient_id'),
    ('appointments', 'doctors', 'doctor_id'),
    ('medical_records', 'patients', 'patient_id'),
    ('medical_records', 'doctors', 'doctor_id'),
    ('consultations', 'patients', 'patient_id'),
    ('consultations', 'doctors', 'doctor_id'),
    ('prescriptions', 'patients', 'patient_id'),
    ('prescriptions', 'doctors', 'doctor_id'),
    ('lab_orders', 'patients', 'patient_id'),
    ('lab_orders', 'doctors', 'doctor_id'),
    ('radiology_orders', 'patients', 'patient_id'),
    ('radiology_orders', 'doctors', 'doctor_id'),
    ('beds', 'patients', 'patient_id'),
    ('admissions', 'patients', 'patient_id'),
    ('admissions', 'doctors', 'doctor_id'),
    ('invoices', 'patients', 'patient_id'),
    ('telemedicine_sessions', 'patients', 'patient_id'),
    ('telemedicine_sessions', 'doctors', 'doctor_id'),
    ('emergency_cases', 'patients', 'patient_id'),
    ('discharge_summaries', 'patients', 'patient_id'),
    ('discharge_summaries', 'doctors', 'doctor_id'),
    ('discharge_summaries', 'admissions', 'admission_id'),
    ('surgeries', 'patients', 'patient_id'),
    ('surgeries', 'doctors', 'surgeon_id'),
    ('insurance_claims', 'patients', 'patient_id'),
    ('insurance_claims', 'invoices', 'invoice_id'),
    ('immunizations', 'patients', 'patient_id'),
    ('immunizations', 'doctors', 'administered_by')
  ) AS x(target_table, ref_table, fk_column)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.target_table)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.target_table AND column_name = t.fk_column) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_tenant_fk_%s ON %I', t.fk_column, t.target_table);
      EXECUTE format(
        'CREATE TRIGGER trg_validate_tenant_fk_%s BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk(%L, %L)',
        t.fk_column, t.target_table, t.ref_table, t.fk_column
      );
    END IF;
  END LOOP;
END;
$do$;
