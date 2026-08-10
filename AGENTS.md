# Health Cloud — repository notes

## Security architecture (billing / trial enforcement)
- `tenants` INSERT is locked by `fn_lock_tenant_insert()` (BEFORE INSERT
  trigger): non-super-admin inserts always get `status='pending'`,
  `grace_period_ends_at=NULL`, and `trial_ends_at` recomputed from
  `platform_settings.trial_days`. `plan_id` is KEPT (drives module access
  during trial). Only the Flutterwave webhook can later set `status=
  'approved'`. Do NOT re-introduce client-supplied `status`/`trial_ends_at`.
- `tenants` UPDATE already prevents owners from changing `status`/
  `plan_id` (`close_tenant_self_approval_gap` migration). Only super admins
  and the webhook (service role) can.
- `tenant_billing_active()` is the single source of truth for billing
  status; it checks an active, non-expired `tenant_subscriptions` row for
  the "approved + plan_id" branch, OR no subscription row at all (admin/
  legacy), OR trial/grace windows. api-v1 calls it via RPC.
- `fn_billing_housekeeping()` lapses expired subscriptions to `past_due`
  and suspends lapsed paid tenants after trial+grace. Call it periodically
  via the `billing-housekeeping` Edge Function (needs `CRON_SECRET`).
- Protected super-admin emails live in the `protected_admin_emails` table
  (NOT in the frontend bundle). `handle_new_user()` auto-promotes matching
  sign-ups. The frontend reads the table at runtime for the cosmetic gate;
  the real authority is `profiles.is_super_admin`.

## Build / lint
- `npm run build` (vite) — passes. `npx tsc --noEmit -p tsconfig.app.json`
  has ~7 PRE-EXISTING errors unrelated to billing security (Dashboard/SuperAdmin
  missing `t`, Settings `owner_user_id` not in the Tenant type, etc.); do not
  assume new TS errors were introduced by a change without diffing.
- Edge Functions are Deno (`Deno.serve`); deno is NOT installed in this
  environment, so they cannot be type-checked locally.

## Secrets to configure for the billing flow
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET`
- `APP_PUBLIC_URL` (and optional `ALLOWED_REDIRECT_ORIGINS`) — used as the
  payment `redirect_url` base (never trust the request `Origin` header).
- `CRON_SECRET` — required to call `billing-housekeeping`.
- Optional `API_ALLOWED_ORIGINS` — locks api-v1 CORS to an allow-list.
