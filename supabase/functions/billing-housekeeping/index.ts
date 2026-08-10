// Billing housekeeping -- suspends tenants whose subscription has lapsed
//
// This is the recurring-expiry half of "pay to continue": once a tenant's
// active subscription reaches its end_date/next_billing_date without being
// renewed, fn_billing_housekeeping() lapses the subscription (past_due) and,
// once the trial + grace window is also fully elapsed, suspends the tenant.
// At that point tenant_billing_active() returns false and both the UI
// BillingGate and the enforce_tenant_billing_active() write trigger block
// the tenant, forcing payment to continue.
//
// SCHEDULING (required for this to do anything):
//   supabase functions deploy billing-housekeeping
// Then call it periodically via either:
//   - Supabase Cron Jobs (Database > Cron Jobs) hitting this URL, or
//   - an external scheduler (cron-job.org, your own cron) hitting:
//       https://<project-ref>.supabase.co/functions/v1/billing-housekeeping
//       with header X-Cron-Secret: <CRON_SECRET> (see CRON_SECRET below).
// Every hour is plenty; every 15 min is fine too.
//
// SECURITY: this function runs with the service role and mutates billing
// state. It must NOT be callable by end users. It accepts requests only
// when CRON_SECRET is set as a function secret AND the caller proves they
// know it via the X-Cron-Secret header. If CRON_SECRET is unset, the
// function refuses to run (it never executes housekeeping unauthenticated).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return json({ status: 'not_configured', message: 'CRON_SECRET is not set. Set it as a function secret before scheduling housekeeping.' });
  }
  const provided = req.headers.get('x-cron-secret');
  if (!provided || provided !== cronSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  // Invoke the database-side housekeeping RPC (idempotent).
  const { error } = await db.rpc('fn_billing_housekeeping');
  if (error) return json({ status: 'error', message: error.message }, 500);

  // Report a quick summary of the resulting state for monitoring.
  const { data: summary } = await db.from('tenant_subscriptions')
    .select('status')
    .in('status', ['active', 'past_due', 'cancelled', 'suspended']);

  const counts: Record<string, number> = {};
  for (const row of (summary ?? []) as any[]) counts[row.status] = (counts[row.status] ?? 0) + 1;

  const { count: suspendedTenants } = await db.from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'suspended');

  return json({ status: 'ok', subscriptions: counts, suspended_tenants: suspendedTenants ?? 0 });
});
