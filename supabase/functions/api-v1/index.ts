// Health Cloud public API (v1)
//
// This is a real, working Edge Function -- not a stub. It validates a
// caller-supplied API key (SHA-256 hashed and compared against
// api_keys.key_hash, matching src/lib/apiKeys.ts on the frontend),
// resolves which tenant that key belongs to, checks that tenant's plan
// actually includes the 'api' module and that its subscription/trial is
// active, and serves a small set of endpoints scoped strictly to that
// tenant's own data.
//
// DEPLOYMENT (required before this does anything -- writing this file
// alone does not make it live):
//   supabase functions deploy api-v1
// It needs no additional secrets: SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are already injected automatically by the
// Supabase platform into every Edge Function's environment.
//
// USAGE (once deployed):
//   curl https://<project-ref>.supabase.co/functions/v1/api-v1/patients \
//     -H "X-API-Key: hck_..."
//
// Endpoints (v1, intentionally small -- extend as real integration needs
// come up rather than speculatively covering every table):
//   GET  /api-v1/patients            list this tenant's patients (paginated)
//   GET  /api-v1/patients/:id        a single patient
//   POST /api-v1/patients            create a patient (requires 'write' scope)
//   GET  /api-v1/appointments        list this tenant's appointments (paginated)
//   POST /api-v1/appointments        create an appointment (requires 'write' scope)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const PAGE_SIZE = 50;

// CORS: by default this public API uses a permissive origin (API-key auth,
// not cookies, so broad CORS is safe). If API_ALLOWED_ORIGINS is set as a
// function secret (comma-separated), CORS is locked to that allow-list
// instead. The preflight always echoes the requesting Origin when it is
// allowed, or '*' otherwise, so existing integrations keep working.
function allowedCorsOrigin(reqOrigin: string | null): string {
  const list = (Deno.env.get('API_ALLOWED_ORIGINS') ?? '').trim();
  if (!list) return '*';
  const allowed = new Set(list.split(',').map((s) => s.trim()).filter(Boolean));
  if (reqOrigin && allowed.has(reqOrigin)) return reqOrigin;
  return allowed.values().next().value ?? '*';
}

function corsHeaders(reqOrigin: string | null) {
  return {
    'Access-Control-Allow-Origin': allowedCorsOrigin(reqOrigin),
    'Access-Control-Allow-Headers': 'x-api-key, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function json(body: unknown, status = 200, reqOrigin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(reqOrigin) },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const reqOrigin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(reqOrigin) });
  }

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return json({ error: 'missing_api_key', message: 'Provide your key in the X-API-Key header.' }, 401, reqOrigin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow, error: keyErr } = await db
    .from('api_keys')
    .select('id, tenant_id, scopes, is_active')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (keyErr || !keyRow || !keyRow.is_active) {
    return json({ error: 'invalid_api_key', message: 'This API key is invalid or has been deactivated.' }, 401, reqOrigin);
  }
  if (!keyRow.tenant_id) {
    // Platform-level keys (tenant_id IS NULL) are not served by this
    // tenant-scoped endpoint -- there is no defined use case for them here.
    return json({ error: 'unsupported_key_type', message: 'This key is not scoped to a tenant.' }, 403, reqOrigin);
  }

  // Confirm the owning tenant's plan actually includes API access, and its
  // subscription/trial is active -- mirrors tenant_module_enabled() /
  // tenant_billing_active() used everywhere else, since this function runs
  // with the service role and therefore bypasses RLS by design.
  const { data: tenant } = await db
    .from('tenants')
    .select('id, status, plan_id, trial_ends_at, grace_period_ends_at, subscription_plans(module_flags)')
    .eq('id', keyRow.tenant_id)
    .maybeSingle();

  if (!tenant) return json({ error: 'tenant_not_found' }, 404, reqOrigin);

  // Use the same server-side authority as RLS / the write trigger so the
  // public API cannot grant access when the DB itself would refuse it
  // (e.g. an active, non-expired subscription is required once "approved").
  const { data: billingActive } = await db.rpc('tenant_billing_active', { p_tenant_id: keyRow.tenant_id });
  const apiModuleEnabled = (tenant as any).subscription_plans?.module_flags?.api === true;

  if (!billingActive) return json({ error: 'subscription_inactive' }, 403, reqOrigin);
  if (!apiModuleEnabled) return json({ error: 'api_not_included_in_plan', message: 'Upgrade to a plan that includes API access.' }, 403, reqOrigin);

  await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);

  const scopes: string[] = keyRow.scopes ?? ['read'];
  const canWrite = scopes.includes('write');
  const tenantId = keyRow.tenant_id;

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean); // e.g. ['api-v1', 'patients']
  const resource = parts[1];
  const resourceId = parts[2];
  const page = parseInt(url.searchParams.get('page') ?? '0', 10) || 0;

  try {
    if (resource === 'patients' && req.method === 'GET' && !resourceId) {
      const { data, count } = await db.from('patients').select('*', { count: 'exact' }).eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      return json({ data, page, page_size: PAGE_SIZE, total: count }, 200, reqOrigin);
    }
    if (resource === 'patients' && req.method === 'GET' && resourceId) {
      const { data, error } = await db.from('patients').select('*').eq('tenant_id', tenantId).eq('id', resourceId).maybeSingle();
      if (error || !data) return json({ error: 'not_found' }, 404, reqOrigin);
      return json({ data }, 200, reqOrigin);
    }
    if (resource === 'patients' && req.method === 'POST') {
      if (!canWrite) return json({ error: 'insufficient_scope', message: 'This key is read-only.' }, 403, reqOrigin);
      const body = await req.json();
      const { data, error } = await db.from('patients').insert({ ...body, tenant_id: tenantId }).select().single();
      if (error) return json({ error: 'insert_failed', message: error.message }, 400, reqOrigin);
      return json({ data }, 201, reqOrigin);
    }
    if (resource === 'appointments' && req.method === 'GET' && !resourceId) {
      const { data, count } = await db.from('appointments').select('*', { count: 'exact' }).eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      return json({ data, page, page_size: PAGE_SIZE, total: count }, 200, reqOrigin);
    }
    if (resource === 'appointments' && req.method === 'POST') {
      if (!canWrite) return json({ error: 'insufficient_scope', message: 'This key is read-only.' }, 403, reqOrigin);
      const body = await req.json();
      const { data, error } = await db.from('appointments').insert({ ...body, tenant_id: tenantId }).select().single();
      if (error) return json({ error: 'insert_failed', message: error.message }, 400, reqOrigin);
      return json({ data }, 201, reqOrigin);
    }

    return json({ error: 'not_found', message: `No such endpoint: ${req.method} /${resource ?? ''}` }, 404, reqOrigin);
  } catch (e) {
    return json({ error: 'internal_error', message: String(e) }, 500, reqOrigin);
  }
});
