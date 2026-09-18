/*
  fn_billing_housekeeping() has no internal authorization check of its
  own (it doesn't need one -- every UPDATE it runs is already gated by
  date comparisons, so calling it early or often changes nothing), but
  there's no reason for it to sit in the public REST API either: it's
  only ever meant to run from the hourly pg_cron job (which calls it
  directly via SQL, bypassing PostgREST and this grant entirely) or the
  billing-housekeeping Edge Function (which runs as service_role).
*/

REVOKE ALL ON FUNCTION public.fn_billing_housekeeping() FROM PUBLIC, anon, authenticated;
