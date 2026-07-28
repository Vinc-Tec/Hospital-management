/*
# Fix: geography tables had no write policy at all, ever

## Why
countries/regions/districts/cities/localities have had RLS enabled with
only a SELECT policy since the very first migration -- no INSERT, UPDATE,
or DELETE policy has ever existed for any of them. With RLS enabled and
no permissive policy for a command, Postgres denies that command outright
for any non-owner role.

This silently broke two real, customer-facing features:
1. Super Admin's "Add Country/Region/District/City/Locality" management
   screens -- every attempt would fail.
2. The signup/onboarding flow's "add my city" / "add my locality" inline
   buttons, used by a new institution when its location isn't already in
   the seeded list -- also would have failed for every real customer who
   needed it.

There was also a second, compounding bug (fixed in application code,
not here): the Super Admin "Add City" screen and the initial data load
both referenced a non-existent `cities.region_id` column -- the real
column is `cities.district_id` (the actual hierarchy is
country -> region -> district -> city -> locality). That is a code fix;
this migration is the missing database-level fix.

## Design
- countries / regions / districts: foundational reference data, so only
  a super admin may create them (matches the Super Admin-only UI for
  these three levels).
- cities / localities: any authenticated user may create them, since a
  brand-new institution signing up needs to be able to add its own city/
  locality inline during onboarding if it isn't already listed. This is
  low-risk, non-sensitive data (just place names) and already has a
  UNIQUE constraint per parent to avoid unbounded duplication.
*/

DROP POLICY IF EXISTS "geo_write_countries" ON countries;
CREATE POLICY "geo_write_countries" ON countries FOR INSERT TO authenticated WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "geo_update_countries" ON countries;
CREATE POLICY "geo_update_countries" ON countries FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "geo_write_regions" ON regions;
CREATE POLICY "geo_write_regions" ON regions FOR INSERT TO authenticated WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "geo_update_regions" ON regions;
CREATE POLICY "geo_update_regions" ON regions FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "geo_write_districts" ON districts;
CREATE POLICY "geo_write_districts" ON districts FOR INSERT TO authenticated WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "geo_update_districts" ON districts;
CREATE POLICY "geo_update_districts" ON districts FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "geo_write_cities" ON cities;
CREATE POLICY "geo_write_cities" ON cities FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "geo_write_localities" ON localities;
CREATE POLICY "geo_write_localities" ON localities FOR INSERT TO authenticated WITH CHECK (true);
