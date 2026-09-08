/*
# Discharge summaries <-> Admissions coherence

## Why
`discharge_summaries.admission_id` already existed as a foreign key, but
the discharge form never exposed it and nothing used it: staff could
write a full discharge summary for a patient while their admission
record stayed 'admitted' and their bed stayed 'occupied' forever. The
bed-freeing trigger added in 20260908130000 only fires when
`admissions.status` itself changes -- creating a discharge summary
never touched that table at all, so the two workflows silently
diverged.

## What this adds
A trigger on `discharge_summaries` (AFTER INSERT) that, when the
summary references a real admission, closes that admission out
automatically: sets its `status` to 'discharged' and its
`discharge_date` to the summary's `discharged_at` -- which then cascades
through the existing `trg_sync_bed_with_admission` trigger to free the
bed too. One clinical action (writing the discharge summary) now
correctly completes the whole chain: admission closed -> bed freed,
instead of requiring staff to separately remember to update two other
records.

Only touches admissions that are still 'admitted', so it's a no-op
(never overwrites) if the admission was already closed by hand.

## Security
SECURITY DEFINER for the same reason as the beds sync trigger: it needs
to write `admissions` from a trigger on `discharge_summaries`. Only
touches the one admission row referenced by the summary being inserted.
*/

CREATE OR REPLACE FUNCTION close_admission_on_discharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.admission_id IS NOT NULL THEN
    UPDATE admissions
    SET status = 'discharged', discharge_date = NEW.discharged_at
    WHERE id = NEW.admission_id AND status = 'admitted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_admission_on_discharge ON discharge_summaries;
CREATE TRIGGER trg_close_admission_on_discharge
AFTER INSERT ON discharge_summaries
FOR EACH ROW EXECUTE FUNCTION close_admission_on_discharge();
