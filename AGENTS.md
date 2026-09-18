# Health Cloud — repository notes

## Critical deployment note (root cause of "still broken" reports)
**Migrations in `supabase/migrations/` do NOT auto-apply to the live DB.**
Supabase only runs them via CI/CD (`supabase db push`) OR when pasted into
the Dashboard SQL Editor. A git push of a migration file changes nothing
at runtime until it is actually executed against the database.

If a user reports an error that a migration is supposed to fix (e.g.
"infinite recursion in policy for relation tenants", "trial bypass"),
the migration almost certainly has not been applied to their live
Supabase project yet. Tell them to paste `supabase/fix_recursion_one_shot.sql`
in the SQL Editor and Run.

## Real hospital photos (Unsplash)
`src/assets/photos/` — real JPEGs (~200KB each), used as backgrounds:
- `waiting-room-reception.jpg` → Auth split panel (left half on lg+)
- `waiting-room-tv.jpg` → Landing hero background
- `reception-desk.jpg` → Onboarding (form + success views)
The old SVGs (`hospital-bg.svg`, `hospital-bg-light.svg`) are kept as a
subtle fallback layer behind the real photos.

## Session persistence
`persistSession: true` in `src/lib/supabase.ts`. Sessions survive refresh
via localStorage. Onboarding failure does NOT drop the session — the user
stays logged in and can retry onboarding. The recursion error (now fixed)
was what blocked completion, not auth loss.

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

## RLS: tenants / tenant_memberships recursion (fixed 2026-08-02)
- The original `tenants` and `tenant_memberships` policies referenced each
  other via plain `EXISTS (SELECT 1 FROM ...)` sub-queries, and both tables
  have RLS → "infinite recursion detected in policy for relation tenants".
  This also made `loadProfileAndTenants()` fail so the platform "forgot"
  the user's tenant on reconnect and sent them back to onboarding.
- Fix: every cross-table check in these policies now calls a SECURITY
  DEFINER helper (`is_super_admin`, `is_tenant_member`, `is_tenant_owner`)
  which bypasses RLS and breaks the cycle. Other tenant-scoped tables
  (patients, doctors, ...) keep their `EXISTS (... tenant_memberships ...)`
  form because the cycle is broken at the tenants/memberships layer.
- `20260802010000_rls_recursion_bulletproof` makes this bulletproof: it
  recreates the three helpers as SECURITY DEFINER (pinned search_path) so
  they unambiguously bypass RLS, and rewrites the `branches` policies
  (the last one that cross-joined tenants + tenant_memberships directly).
  After both migrations, NO RLS policy references tenants/tenant_memberships
  via a raw cross-table sub-query, so the recursion error cannot occur.
- **IMPORTANT**: these migrations must be applied to the live Supabase DB
  (`supabase db push` or the SQL editor). The frontend error persists until
  they are applied. The helpers terminate even without RLS bypass because
  `is_tenant_member` only reads the caller's own membership rows
  (`user_id = auth.uid()`), so the cycle is structurally broken.

## Tenant memory / active-tenant switching
- `loadProfileAndTenants()` reads `tenant_memberships` (user_id) AND
  `tenants` (owner_user_id) so a returning user is never re-onboarded.
- `setActiveTenantId(id)` is async: it persists `hc_active_tenant_id` AND
  reloads that tenant row immediately (previously the switch only took
  effect on next login).

## Live DB sync (2026-09-16)
All 68 migrations in `supabase/migrations/` are now applied on the live
project (`felojfakygdnprfrhnkq`, "Vinc-Tec's Project"). Previously the
live DB was ~19 migrations behind (everything since
`20260902000000_add_telegram_provider`), which meant several fixes that
existed in this repo were not actually in effect, including the
2026-08-05 trial/subscription bypass protection that had silently
regressed back to being exploitable since 2026-08-06 (see
`20260908180000_restore_trial_bypass_protection.sql`) -- this is now
re-applied and confirmed live.

## Paddle: webhook deployed, needs secrets (2026-09-16)
`paddle-initiate` was already deployed; `paddle-webhook` (the only
place that grants access after a Paddle payment) was missing from the
live project entirely -- deployed now. Paddle is still INACTIVE until
these are set as Edge Function secrets on the live project (not in
this repo -- never commit secrets):
- `PADDLE_WEBHOOK_SECRET` -- from Paddle Dashboard > Developer Tools >
  Notifications, after creating a destination pointed at
  `https://felojfakygdnprfrhnkq.supabase.co/functions/v1/paddle-webhook`
  subscribed to `transaction.completed`.
- `PADDLE_PRICE_MAP` -- confirmed against the live Paddle catalog and
  matching `subscription_plans.price_monthly`/`price_yearly` exactly:
  `{"starter:monthly":"pri_01m1m9vr47s70ax3zzevazjecq","starter:yearly":"pri_01m2240kmbn984ygt114pg358n","professional:monthly":"pri_01m1m9x11mtscngqh4p04rpy4q","professional:yearly":"pri_01m2241q3dx9xp3gw11m2rszh4","business:monthly":"pri_01m1m9yk3kf6t9ecfbyntcedba","business:yearly":"pri_01m2242tb0fc5j7kecme40x55n","enterprise:monthly":"pri_01m1ma00wwf63r85mq6bp4cw4r","enterprise:yearly":"pri_01m2243rgepzw9nfnpm23qj3s3"}`
- Frontend build env: `VITE_PADDLE_CLIENT_TOKEN` (public token, from
  Paddle Dashboard > Developer Tools > Authentication), optionally
  `VITE_PADDLE_ENV=sandbox` while testing.

## Automation: billing housekeeping + reminders now actually scheduled (2026-09-17)
Both `billing-housekeeping` and `send-appointment-reminders` were fully
coded and deployed but **nothing was ever calling them** -- no Supabase
Cron Job, no external scheduler. In practice this meant lapsed
subscriptions never got suspended and appointment reminders never sent,
regardless of any other configuration. Fixed by enabling `pg_cron` +
`pg_net` and scheduling two jobs directly in the database (`cron.job`):
- `billing-housekeeping-hourly` (`0 * * * *`) calls `fn_billing_housekeeping()`
  directly (no HTTP hop, no secret needed -- it's a plain DB function).
- `appointment-reminders-every-30-min` (`*/30 * * * *`) calls the
  `send-appointment-reminders` Edge Function via `net.http_post`,
  authenticated with `X-Cron-Secret`.

For the reminders job to actually authenticate (rather than get a
harmless 401), set this project's `CRON_SECRET` function secret to
match exactly what the cron job sends:
`306ea18cc500f31fc2cca8898fc2ab993df28435e35587d3fb5132b3ed723da1`
Reminders will still report `not_configured` (no error, no message sent)
until `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM` are also set.

## AI assistant: deployed, needs GEMINI_API_KEY (2026-09-17)
`ai-assist` Edge Function (Gemini-backed chat, free for every
authenticated tenant member) is fully coded, deployed, and already
wired into the Dashboard UI. Set `GEMINI_API_KEY` as a Supabase Edge
Function secret to activate it -- it must be a Supabase secret, NOT a
frontend/Cloudflare env var, since the key is only ever read
server-side inside the function.

## AI assistant: active via Vault (2026-09-17)
`ai-assist` is now fully active. The Gemini key lives in Supabase Vault
(`vault.secrets`, name `gemini_api_key`) rather than a plain Edge
Function secret, read through `public.get_vault_secret(text)` -- a
SECURITY DEFINER RPC whose EXECUTE is granted to `service_role` only
(revoked from anon/authenticated), since PostgREST doesn't expose the
`vault` schema directly. Setting `GEMINI_API_KEY` as a function secret
still works and takes priority if present -- rotating the key is then
just `SELECT vault.update_secret(id, new_value)` or re-running
`vault.create_secret`, no redeploy needed.

## Twilio is now per-tenant, not global (2026-09-17)
`send-appointment-reminders` previously read ONE shared Twilio account
from Edge Function secrets (`TWILIO_ACCOUNT_SID` etc.) -- meaning every
tenant's reminders would have gone out from the same number, billed to
the same account. Doesn't hold up for a platform meant to serve
unrelated clinics independently. Reworked so each tenant connects their
OWN Twilio account from Settings > Integrations (new provider
`'twilio'`, same pattern as WhatsApp/Telegram): `account_sid`,
`auth_token`, `from` (SMS sender, via the new PhoneInput), and
optionally `whatsapp_from` + `whatsapp_template_sid`. The function now
looks up `integrations` per appointment's `tenant_id` (service-role,
since it runs unattended) instead of `Deno.env`; a tenant with nothing
connected is just skipped, no error. Also fixed: PhoneInput stores
"+225 0700000000" (space for readability) but Twilio needs strict
E.164 -- added `toE164()` to strip it before every Twilio call.

## Font: Glacial Indifference import removed for good (2026-09-18)
`src/index.css` still had a CDN `@import` for 'Glacial Indifference'
listed first in the body font stack, alongside a comment claiming it
"isn't loaded anywhere." That claim was true in practice but the import
itself was still live -- any environment where that CDN request
succeeded would have silently reintroduced the exact bug the project
moved away from Poppins for (missing/broken glyphs on French accented
characters). Removed the import and the dead font names entirely; body
and headings both now explicitly use 'Poppins' (index.html's Google
Fonts link updated to load weight 400 too, not just 500/600/700, so
regular body text renders the actual requested weight).

## Security hardening pass (2026-09-18)
Advisors flagged 31 SECURITY DEFINER functions callable via
`/rest/v1/rpc/<name>` by anon/authenticated. Checked each:
- `dispense_prescription`, `get_staff_performance`, `staff_performance`
  already have their own internal `is_tenant_member`/`is_super_admin`
  checks -- not exploitable, left as-is.
- 24 were pure trigger functions (`RETURNS trigger`) -- Postgres already
  refuses to call these outside trigger context, so not exploitable
  either, but there's no reason to leave them in the public API surface.
  Revoked EXECUTE from PUBLIC/anon/authenticated on all of them; trigger
  firing is unaffected (it doesn't go through the EXECUTE check).
- `fn_billing_housekeeping` had no internal auth check (didn't need
  one -- every UPDATE it runs is date-gated) but also had no reason to
  be publicly callable. Revoked EXECUTE the same way; the hourly
  pg_cron job and the Edge Function both call it directly and are
  unaffected.
- Remaining ~12 (`is_tenant_member`, `is_super_admin`, `tenant_billing_active`,
  etc.) are boolean/read-only helpers used throughout RLS policies
  across the schema -- left callable to avoid risking any policy that
  might depend on them being reachable for a given role.
Also confirmed via advisors (not yet fixed, needs Dashboard access this
setup doesn't have a tool for): enable "Leaked Password Protection"
under Authentication > Providers > Email.

## i18n
- `Lang = 'fr' | 'en'`, persisted in `localStorage('hc_lang')`, default `fr`.
  `LangToggle` in `src/components/brand.tsx`. The hero badge and trust strip
  use `hero.badge` / `hero.badge.suffix` / `hero.trust.*` keys (no hardcoded
  English in the hero).

