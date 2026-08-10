/*
 * Allow any authenticated user to create country / region / district entries.
 *
 * During onboarding, a tenant administrator must be able to select their
 * location. The geography reference tables (countries, regions, districts)
 * are seeded with a limited set, so a user whose country/region/district is
 * absent is blocked (country_id and region_id are required to proceed).
 *
 * cities and localities already allow any authenticated user to INSERT
 * (migration 20260728130000, `WITH CHECK (true)`). This extends the same
 * policy to countries, regions and districts so onboarding can offer a
 * "saisie manuelle" (manual entry) option for the whole hierarchy.
 *
 * Safety:
 *  - These are non-sensitive public reference tables (name + parent + a few
 *    display attributes), not billing or tenant data.
 *  - UNIQUE constraints already prevent duplicates:
 *      countries UNIQUE(name), UNIQUE(iso2)
 *      regions  UNIQUE(country_id, name)
 *      districts UNIQUE(region_id, name)
 *  - Only INSERT is opened to authenticated users; UPDATE/DELETE remain
 *    super-admin only (unchanged).
 *  - This does NOT bypass any billing/payment control.
 */

DROP POLICY IF EXISTS "geo_write_countries" ON countries;
CREATE POLICY "geo_write_countries" ON countries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "geo_write_regions" ON regions;
CREATE POLICY "geo_write_regions" ON regions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "geo_write_districts" ON districts;
CREATE POLICY "geo_write_districts" ON districts FOR INSERT
  TO authenticated WITH CHECK (true);
