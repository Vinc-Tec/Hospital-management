/*
# Add 'payunit' to payment_gateway_enum (critical fix)

payment_gateway_enum did not include 'payunit'. Every successful
PayUnit payment would reach payunit-webhook's final step (inserting the
tenant_subscriptions row with payment_gateway='payunit') and fail there
with "invalid input value for enum payment_gateway_enum: payunit" --
meaning a customer could pay successfully via PayUnit and still never
actually get upgraded. Also affected payments.gateway, which uses the
same enum type. 'paystack' was already a valid value (added ahead of
time for the Paystack integration), so only 'payunit' was missing.

Applied directly to the live database via the Supabase connector; this
file brings the migration history in the repo in sync with that.
*/

ALTER TYPE payment_gateway_enum ADD VALUE IF NOT EXISTS 'payunit';
