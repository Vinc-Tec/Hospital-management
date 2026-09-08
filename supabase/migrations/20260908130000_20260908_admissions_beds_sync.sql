/*
# Admissions <-> Beds coherence: automatic occupancy sync

## Why
`admissions.bed_id` existed in the schema but the admission form never
exposed a bed picker, and nothing ever set a bed's status to 'occupied'
when a patient was admitted to it (or back to 'available' on discharge)
-- beds.status was purely manual, disconnected from admissions.status.
Two patients could be "admitted" to the same bed with nothing to catch
it.

## What this adds
A trigger on `admissions` (INSERT/UPDATE/DELETE) that keeps `beds`
truthful automatically, no matter which client writes to admissions
(this app's UI, the public API, a future import job):
- Admitting a patient to a bed (status='admitted' + bed_id set) marks
  that bed 'occupied' and stamps its patient_id.
- Raises `bed_already_occupied` if that bed is already occupied by a
  *different* patient -- double-booking is now impossible instead of a
  silent data-integrity gap.
- Discharging/transferring, deleting the admission, or moving the
  patient to a different bed automatically frees the previous bed
  (back to 'available', patient_id cleared) -- but only if it was still
  actually assigned to that same patient, so an unrelated manual change
  to the bed in between isn't clobbered.

## Security
SECURITY DEFINER (needs to write `beds` from a trigger on `admissions`,
tables a plain UPDATE on admissions wouldn't otherwise grant), but it
only ever touches the one bed row implicated by the admission being
written -- no broader privilege is exposed.
*/

CREATE OR REPLACE FUNCTION sync_bed_with_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bed_id IS NOT NULL AND OLD.status = 'admitted' THEN
      UPDATE beds SET status = 'available', patient_id = NULL
        WHERE id = OLD.bed_id AND patient_id = OLD.patient_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.bed_id IS NOT NULL AND (OLD.bed_id IS DISTINCT FROM NEW.bed_id OR NEW.status <> 'admitted') THEN
      UPDATE beds SET status = 'available', patient_id = NULL
        WHERE id = OLD.bed_id AND patient_id = OLD.patient_id;
    END IF;
  END IF;

  IF NEW.bed_id IS NOT NULL AND NEW.status = 'admitted' THEN
    IF EXISTS (SELECT 1 FROM beds WHERE id = NEW.bed_id AND status = 'occupied' AND patient_id IS DISTINCT FROM NEW.patient_id) THEN
      RAISE EXCEPTION 'bed_already_occupied';
    END IF;
    UPDATE beds SET status = 'occupied', patient_id = NEW.patient_id WHERE id = NEW.bed_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bed_with_admission ON admissions;
CREATE TRIGGER trg_sync_bed_with_admission
AFTER INSERT OR UPDATE OR DELETE ON admissions
FOR EACH ROW EXECUTE FUNCTION sync_bed_with_admission();
