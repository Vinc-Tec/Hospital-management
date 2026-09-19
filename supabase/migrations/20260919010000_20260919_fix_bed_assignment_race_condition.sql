/*
  Bug found on audit: sync_bed_with_admission() checked bed
  availability with a plain EXISTS (no row lock), then updated the bed
  with no status guard in the UPDATE's WHERE clause. Two admissions to
  the same bed submitted at nearly the same time could both pass the
  check before either committed, and the second UPDATE would silently
  overwrite the first patient's occupancy -- no error to either
  clinician, and the bed ends up pointing at the wrong patient. Locks
  the bed row first (serializing concurrent admissions to the same
  bed) and adds a status guard directly on the UPDATE as defense in
  depth.
*/

CREATE OR REPLACE FUNCTION sync_bed_with_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bed_status text;
  v_bed_patient uuid;
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
    SELECT status, patient_id INTO v_bed_status, v_bed_patient FROM beds WHERE id = NEW.bed_id FOR UPDATE;
    IF v_bed_status = 'occupied' AND v_bed_patient IS DISTINCT FROM NEW.patient_id THEN
      RAISE EXCEPTION 'bed_already_occupied';
    END IF;
    UPDATE beds SET status = 'occupied', patient_id = NEW.patient_id
      WHERE id = NEW.bed_id AND (status != 'occupied' OR patient_id = NEW.patient_id);
  END IF;

  RETURN NEW;
END;
$$;
