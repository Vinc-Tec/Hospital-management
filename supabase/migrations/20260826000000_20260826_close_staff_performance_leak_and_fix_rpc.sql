/*
# Close a live cross-tenant data leak + fix a broken SuperAdmin RPC

## Security fix (critical)
`public.staff_performance` was a SECURITY DEFINER *view* (created in
20260721_reports_commercial_performance) with no tenant filtering, and
`anon` (fully unauthenticated) had SELECT on it. Anyone on the internet
could call `/rest/v1/staff_performance` with no login at all and read
every tenant's doctor names, specialties and activity counts platform-
wide. Confirmed via `information_schema.role_table_grants` that `anon`
held SELECT before this migration. Nothing in the app repo queries this
view directly (grep confirms only the two RPCs below are called), so it
is locked down to service_role/postgres only.

## Bug fix
`src/pages/SuperAdmin.tsx` (SaPerformance) calls
`supabase.rpc('staff_performance', { p_tenant })`, expecting a function.
No function by that name existed -- only the view above (views and
functions live in separate Postgres catalogs, so PostgREST's RPC lookup
silently failed every time a super admin opened the Performance tab).
This adds the actual function, properly scoped to super-admin-only and
filtered to the requested tenant.

Note: revenue is returned as 0. There is no schema path from invoices
to doctors (invoices only reference patient_id; nothing links a patient
or invoice to a specific doctor), so a real per-doctor revenue figure
is not computable from the current schema. Returning 0 rather than a
join that would silently produce wrong numbers.
*/

REVOKE ALL ON public.staff_performance FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_performance(p_tenant uuid)
RETURNS TABLE (
  doctor_name text, appointment_count bigint, revenue numeric, avg_rating numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;

  RETURN QUERY
  SELECT
    (d.first_name || ' ' || d.last_name) AS doctor_name,
    COALESCE(apt.cnt, 0) AS appointment_count,
    0::numeric AS revenue,
    NULL::numeric AS avg_rating
  FROM doctors d
  LEFT JOIN (
    SELECT doctor_id, count(*) AS cnt FROM appointments
    WHERE tenant_id = p_tenant AND doctor_id IS NOT NULL GROUP BY doctor_id
  ) apt ON apt.doctor_id = d.id
  WHERE d.tenant_id = p_tenant;
END;
$$;
