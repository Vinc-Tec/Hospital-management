/*
  Add 'paddle' to payment_gateway_enum.

  Paddle is a Merchant of Record: it becomes the seller of record and
  automatically handles sales tax/VAT/GST collection and remittance
  worldwide, which none of the other gateways here do. See
  supabase/functions/paddle-initiate/index.ts for the full setup steps
  and supabase/functions/paddle-webhook/index.ts for the access-granting
  logic.

  ALTER TYPE ... ADD VALUE cannot run inside a multi-statement
  transaction block in older Postgres, so this mirrors the exact same
  single-statement pattern already used in
  20260828000000_add_payunit_to_payment_gateway_enum.sql.
*/

ALTER TYPE payment_gateway_enum ADD VALUE IF NOT EXISTS 'paddle';
