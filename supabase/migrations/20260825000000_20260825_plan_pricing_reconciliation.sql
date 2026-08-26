/*
# Reconcile subscription plan pricing, limits and marketing copy

## Why
Three separate places describe what each plan includes, and they had
drifted out of sync with each other:
1. `subscription_plans` (price_monthly/price_yearly/max_*/features) --
   the actual seeded values from 20260720200910_seed_plans_and_geography,
   still at the original launch prices (Professional $99, Business $189,
   Enterprise $469) and an unrelated features list.
2. `module_flags` on the same table -- the real, enforced entitlements
   (20260726_missing_modules_and_plan_gating + later fixes), which is
   what actually gates access via tenant_module_enabled().
3. The public landing page (src/pages/Landing.tsx) -- hardcoded display
   numbers, previously $49/$149/$399/"Contact us", not read from the DB
   at all.

None of the three agreed, and the Business tier's marketing copy
promised "Advanced Analytics" (the `performance` module) which its own
module_flags row does not grant -- that module only turns on at
Enterprise. This migration makes `subscription_plans` match the
landing page (now the single source of truth for pricing) and rewrites
`features` to accurately describe what module_flags actually grants at
each tier, so the in-app plan picker (Settings > Billing) stops
advertising things a tenant cannot actually use.

## Changes
- price_monthly/price_yearly: Starter 49/470, Professional 149/1430,
  Business 299/2870 (was 189/1810), Enterprise 429/4118 (was 469/4500)
- max_patients raised for Business (100,000, matching the "extended"
  tier positioning) and set to 0 (unlimited) for Enterprise, consistent
  with max_users/max_doctors already being 0 (unlimited) at Enterprise
- features rewritten per tier to list only what that tier's
  module_flags actually enables, so nothing is oversold
*/

UPDATE subscription_plans SET
  price_monthly = 49, price_yearly = 470,
  max_users = 10, max_doctors = 3, max_patients = 500,
  features = '["Patients, appointments, doctors, invoices & reports","Email support","1 location"]'::jsonb
WHERE code = 'starter';

UPDATE subscription_plans SET
  price_monthly = 149, price_yearly = 1430,
  max_users = 50, max_doctors = 15, max_patients = 5000,
  features = '["Records, consultations & prescriptions","Lab & pharmacy","Priority support","3 locations"]'::jsonb
WHERE code = 'professional';

UPDATE subscription_plans SET
  price_monthly = 299, price_yearly = 2870,
  max_users = 200, max_doctors = 50, max_patients = 100000,
  features = '["Radiology, beds, admissions & surgeries","Inventory, HR, payroll & roles","API access & integrations","10 locations"]'::jsonb
WHERE code = 'business';

UPDATE subscription_plans SET
  price_monthly = 429, price_yearly = 4118,
  max_users = 0, max_doctors = 0, max_patients = 0,
  features = '["Every module: analytics, telemedicine, insurance, emergency, marketplace","Unlimited doctors & patients","White-label & custom integrations","SLA support"]'::jsonb
WHERE code = 'enterprise';
