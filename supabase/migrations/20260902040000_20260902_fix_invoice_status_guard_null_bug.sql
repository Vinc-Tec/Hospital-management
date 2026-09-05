/*
  Fix guard_invoice_status_update(): unreliable NULL handling let a
  manual edit set an invoice to 'paid'/'partial' WITHOUT going through
  the Cash Desk, on any database connection that had never yet run the
  patient_payments reconciliation trigger.

  current_setting('app.allow_status_sync', true) returns NULL (not the
  string 'off') the first time it's read on a given connection --
  before the reconciliation trigger has ever set it. In PL/pgSQL,
  `NOT (NULL = 'on')` evaluates to NULL, and an IF condition that
  evaluates to NULL is treated as FALSE, meaning the guard's "block it"
  branch was skipped -- exactly backwards from what was intended. In
  practice, this meant a freshly pooled connection could let a hand
  edit through as 'paid' with no real payment recorded, while a
  connection that had already processed a real payment correctly
  blocked further manual edits -- inconsistent, connection-dependent
  behavior, which is the worst kind of bug to chase down from symptoms
  alone. COALESCE against a NULL default of 'off' makes this
  deterministic regardless of connection history.
*/

CREATE OR REPLACE FUNCTION guard_invoice_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('paid', 'partial')
     AND COALESCE(current_setting('app.allow_status_sync', true), 'off') != 'on' THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;
