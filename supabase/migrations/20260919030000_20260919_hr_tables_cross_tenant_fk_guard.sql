/*
  Isolation gap found on audit: employee_records, payslips, and
  leave_requests were all added after the systemic cross-tenant FK
  guard (20260902090000_systemic_cross_tenant_fk_validation.sql) and
  were never added to it. Their staff_id could in principle reference
  a staff member belonging to a DIFFERENT tenant -- RLS still scopes
  the row itself to the right tenant_id, but the referenced staff_id
  pointing at a stranger's employee is a real isolation hole (wrong
  data joined in reports, salary info crossing tenant boundaries).
  Reuses the same validate_same_tenant_fk() function every other
  table's guard already uses.
*/

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_staff_id ON employee_records;
CREATE TRIGGER trg_validate_tenant_fk_staff_id BEFORE INSERT OR UPDATE ON employee_records
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('staff', 'staff_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_staff_id ON payslips;
CREATE TRIGGER trg_validate_tenant_fk_staff_id BEFORE INSERT OR UPDATE ON payslips
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('staff', 'staff_id');

DROP TRIGGER IF EXISTS trg_validate_tenant_fk_staff_id ON leave_requests;
CREATE TRIGGER trg_validate_tenant_fk_staff_id BEFORE INSERT OR UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION validate_same_tenant_fk('staff', 'staff_id');
