/*
# RLS performance at scale: stop re-evaluating auth.uid() per row

The Supabase performance advisor flagged 139 RLS policies across nearly
every table with "auth_rls_initplan": each one calls a shared helper
function (is_tenant_member, is_super_admin, is_tenant_owner,
tenant_module_enabled, tenant_billing_active, profiles_share_tenant)
that internally calls bare auth.uid(). Postgres's planner cannot hoist
a bare auth.uid() call inside a STABLE SQL function into a single
per-statement evaluation the way it can when the call is written as
(select auth.uid()) -- so on a table scan this re-invokes auth.uid()
(and therefore re-reads the JWT claim) once per row instead of once
per query. At a handful of rows this is invisible; at the millions-of-
rows scale this app is meant to support, it stops being invisible.

Because virtually every flagged policy routes through this small set
of shared functions, rewriting auth.uid() -> (select auth.uid()) inside
these six function bodies (rather than in every individual policy)
fixes the overwhelming majority of the 139 flagged instances in one
safe, minimal change. Logic is unchanged -- (select auth.uid()) and
auth.uid() return the identical value, only the query plan differs.

Apply this file's SQL directly via Supabase Dashboard > SQL Editor if
the Supabase connector is unavailable when this migration needs running.
*/

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT p.is_super_admin FROM profiles p WHERE p.id = (select auth.uid())), false); $$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = (select auth.uid()) AND tm.tenant_id = p_tenant_id); $$;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT (t.owner_user_id = (select auth.uid())) FROM tenants t WHERE t.id = p_tenant_id), false); $$;

CREATE OR REPLACE FUNCTION public.profiles_share_tenant(p_other_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships tm_self
    JOIN tenant_memberships tm_other ON tm_other.tenant_id = tm_self.tenant_id
    WHERE tm_self.user_id = (select auth.uid()) AND tm_other.user_id = p_other_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_billing_active(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR COALESCE(
      (SELECT
        (
          (
            t.status = 'approved'
            AND t.plan_id IS NOT NULL
            AND (
              NOT EXISTS (
                SELECT 1 FROM tenant_subscriptions ts2 WHERE ts2.tenant_id = t.id
              )
              OR EXISTS (
                SELECT 1
                FROM tenant_subscriptions ts
                WHERE ts.tenant_id = t.id
                  AND ts.status = 'active'
                  AND ts.plan_id = t.plan_id
                  AND COALESCE(ts.end_date, ts.next_billing_date) IS NOT NULL
                  AND COALESCE(ts.end_date, ts.next_billing_date)::date >= current_date
              )
            )
          )
          OR t.trial_ends_at > now()
          OR COALESCE(t.grace_period_ends_at, t.trial_ends_at + interval '3 days') > now()
        )
       FROM tenants t
       WHERE t.id = p_tenant_id),
      false
    );
$$;

CREATE OR REPLACE FUNCTION public.tenant_module_enabled(p_tenant_id uuid, p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR COALESCE(
      (SELECT (sp.module_flags ->> p_module)::boolean
       FROM tenants t
       JOIN subscription_plans sp ON sp.id = t.plan_id
       WHERE t.id = p_tenant_id),
      false
    );
$$;
