/*
  Security hardening: every trigger function in the public schema is
  exposed by PostgREST as a callable RPC endpoint by default
  (/rest/v1/rpc/<name>), even though a trigger function can only ever
  run as a trigger (Postgres itself rejects a direct call with
  "trigger functions can only be called as triggers"). Not exploitable
  today, but there is no reason for these to sit in the public API
  surface at all -- revoking EXECUTE removes the RPC endpoint entirely
  without touching how triggers fire (trigger invocation does not go
  through the EXECUTE privilege check).
*/

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn.proname, fn.args);
  END LOOP;
END;
$$;
