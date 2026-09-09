/*
# Fix yearly pricing to match the real "2 months free" offer

## Why
subscription_plans.price_yearly was seeded with a ~20% discount (470/
1430/2870/4118 for starter/professional/business/enterprise), but the
actual commercial offer -- and what's genuinely configured as Paddle
price objects, already live and Active -- is "2 months free" (yearly =
10x monthly): 490/1490/2990/4290. The two had silently drifted apart;
left as-is, a customer would be charged Paddle's correct 490 but the
app's own payment record and pricing page would say 470, contradicting
what the customer actually paid.

## What this does
Updates price_yearly on all four plans to 10x their price_monthly,
matching Paddle exactly. price_monthly is untouched (it already matched
Paddle). See also the matching fix in src/pages/Landing.tsx, which is
this schema's single source of truth for pricing per
20260825_plan_pricing_reconciliation.sql -- both had to change together.
*/

UPDATE subscription_plans SET price_yearly = price_monthly * 10;
