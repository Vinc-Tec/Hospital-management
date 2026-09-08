/*
# Emergency <-> Admissions coherence

## Why
emergency_cases.status can be set to 'admitted', but nothing ever
created the actual admission record -- a patient could sit "admitted"
in the ER module forever with no corresponding row in `admissions`, no
bed workflow, nothing for the ward staff to see. The two modules had no
relationship at all beyond sharing a patient_id.

## What this adds
1. `admissions.source_emergency_case_id` (nullable FK): traceability
   back to the ER visit that led to the admission, for admissions that
   came from one.
2. A trigger on `emergency_cases` (INSERT/UPDATE) that, when a case's
   status becomes 'admitted' and it's linked to a real patient record
   (not a still-unregistered walk-in -- see the walk_in_name path
   below), automatically opens an `admissions` row for that patient if
   one doesn't already exist for this ER case. Ward staff then only
   need to assign a bed and doctor from the Admissions module instead
   of re-entering the admission from scratch.
   Walk-in ER cases with no patient_id yet (chief_complaint recorded
   before registration) are intentionally left out of the automation --
   an admission needs a real patient record to attach to, so those
   still require a person to register the patient first and admit them
   normally; this trigger only closes the gap for the common case where
   the patient record already exists.

## Security
SECURITY DEFINER since it needs to INSERT into `admissions` from a
trigger on `emergency_cases`; only ever inserts the one row implied by
the emergency case being written, scoped to that case's own tenant_id.
*/

ALTER TABLE admissions ADD COLUMN IF NOT EXISTS source_emergency_case_id uuid REFERENCES emergency_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS admissions_source_emergency_idx ON admissions(source_emergency_case_id);

CREATE OR REPLACE FUNCTION create_admission_from_emergency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'admitted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'admitted') THEN
    IF NEW.patient_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM admissions WHERE source_emergency_case_id = NEW.id) THEN
      INSERT INTO admissions (tenant_id, patient_id, admission_date, reason, status, source_emergency_case_id)
      VALUES (NEW.tenant_id, NEW.patient_id, now(), NEW.chief_complaint, 'admitted', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_admission_from_emergency ON emergency_cases;
CREATE TRIGGER trg_create_admission_from_emergency
AFTER INSERT OR UPDATE ON emergency_cases
FOR EACH ROW EXECUTE FUNCTION create_admission_from_emergency();
