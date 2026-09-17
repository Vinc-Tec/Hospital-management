/*
  Bug fix: `countries` (name/iso2/phone_code/currency_code/timezone) is
  public reference data -- nothing tenant-specific or sensitive in it --
  but its SELECT policy was 'authenticated'-only. In practice this made
  PhoneInput (src/components/ui.tsx) silently show no country code
  dropdown whenever its fetch raced ahead of session restoration on
  first paint, or ran on a screen before login. Since there's nothing
  to protect here, allow anon read too and remove that whole class of
  bug rather than chasing the race.
*/

DROP POLICY IF EXISTS "geo_select" ON countries;
CREATE POLICY "geo_select" ON countries FOR SELECT TO anon, authenticated USING (true);
