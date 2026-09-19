/*
  Gap found on audit: surgeries already guard against a room being
  double-booked (check_operating_room_conflict), but regular
  appointments had no equivalent -- two different patients could be
  booked with the same doctor at the exact same time with no warning
  anywhere, client or server. Mirrors the surgery-room conflict guard:
  skips the check when no doctor is assigned yet, and only considers
  appointments that are still actually happening (not
  cancelled/no_show).
*/

CREATE OR REPLACE FUNCTION check_doctor_appointment_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.doctor_id IS NULL OR NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.tenant_id = NEW.tenant_id
      AND a.id <> NEW.id
      AND a.doctor_id = NEW.doctor_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND a.scheduled_at < (NEW.scheduled_at + make_interval(mins => NEW.duration_min))
      AND NEW.scheduled_at < (a.scheduled_at + make_interval(mins => a.duration_min))
  ) THEN
    RAISE EXCEPTION 'doctor_appointment_conflict';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_doctor_appointment_conflict ON appointments;
CREATE TRIGGER trg_check_doctor_appointment_conflict
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION check_doctor_appointment_conflict();
