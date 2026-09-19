/*
  Isolation gaps found on audit: these foreign keys were never added
  to the systemic cross-tenant guard (added in later migrations than
  20260902090000). Each could in principle reference a row belonging
  to a DIFFERENT tenant -- RLS still scopes the referencing row itself
  correctly, but the reference crossing tenant boundaries is a real
  hole (e.g. an invoice_item silently inflating a stranger's invoice
  total via the recalc trigger, a prescription linked to another
  clinic's pharmacy stock, a queue entry pointing at another tenant's
  patient/doctor/appointment).
*/

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_source_emergency_case_id ON admissions;
CREATE TRIGGER trg_validate_tenant_fk_source_emergency_case_id BEFORE INSERT OR UPDATE ON admissions
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('emergency_cases', 'source_emergency_case_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_bed_id ON admissions;
CREATE TRIGGER trg_validate_tenant_fk_bed_id BEFORE INSERT OR UPDATE ON admissions
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('beds', 'bed_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_invoice_id ON invoice_items;
CREATE TRIGGER trg_validate_tenant_fk_invoice_id BEFORE INSERT OR UPDATE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('invoices', 'invoice_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_patient_id ON patient_queue;
CREATE TRIGGER trg_validate_tenant_fk_patient_id BEFORE INSERT OR UPDATE ON patient_queue
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('patients', 'patient_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_appointment_id ON patient_queue;
CREATE TRIGGER trg_validate_tenant_fk_appointment_id BEFORE INSERT OR UPDATE ON patient_queue
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('appointments', 'appointment_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_doctor_id ON patient_queue;
CREATE TRIGGER trg_validate_tenant_fk_doctor_id BEFORE INSERT OR UPDATE ON patient_queue
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('doctors', 'doctor_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_pharmacy_item_id ON prescriptions;
CREATE TRIGGER trg_validate_tenant_fk_pharmacy_item_id BEFORE INSERT OR UPDATE ON prescriptions
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('pharmacy_items', 'pharmacy_item_id');
