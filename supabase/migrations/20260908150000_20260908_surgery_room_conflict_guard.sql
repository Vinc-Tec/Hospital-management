/*
# Surgeries: prevent overlapping operating-room bookings

## Why
`operating_room` is free text with no link to any other resource table,
and nothing checked for overlap -- two surgeries could be scheduled in
the same room at overlapping times with no warning, only discovered
when staff physically show up to a double-booked OR.

## What this adds
A trigger on `surgeries` (INSERT/UPDATE) that rejects a booking whose
[scheduled_at, scheduled_at + duration_minutes) window overlaps another
active surgery (status not 'cancelled'/'postponed') in the same room for
the same tenant, raising `operating_room_conflict` instead of silently
allowing it. Room names are compared case-and-whitespace-insensitively
so "OR 1" and "or 1 " are recognized as the same room. Excludes the row
being updated from the check against itself.

## Security
SECURITY DEFINER only to read across all of the tenant's surgeries for
the overlap check regardless of who's inserting; it doesn't write
anything outside the row already being inserted/updated by the caller's
own statement.
*/

CREATE OR REPLACE FUNCTION check_operating_room_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'postponed') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM surgeries s
    WHERE s.tenant_id = NEW.tenant_id
      AND s.id <> NEW.id
      AND lower(btrim(s.operating_room)) = lower(btrim(NEW.operating_room))
      AND s.status NOT IN ('cancelled', 'postponed')
      AND s.scheduled_at < (NEW.scheduled_at + make_interval(mins => NEW.duration_minutes))
      AND NEW.scheduled_at < (s.scheduled_at + make_interval(mins => s.duration_minutes))
  ) THEN
    RAISE EXCEPTION 'operating_room_conflict';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_operating_room_conflict ON surgeries;
CREATE TRIGGER trg_check_operating_room_conflict
BEFORE INSERT OR UPDATE ON surgeries
FOR EACH ROW EXECUTE FUNCTION check_operating_room_conflict();
