// Invite a team member to a tenant, with a role and its permission set
//
// STATUS: real and active as soon as this is deployed -- unlike the
// payment/SMS/monitoring functions, this needs NO third-party account.
// It uses Supabase Auth's own built-in transactional email (the same
// system that sends password-reset emails) to invite a new user by
// email; Supabase handles delivery.
//
// DEPLOY: supabase functions deploy invite-team-member
//
// FLOW:
//   1. Caller must be an authenticated tenant owner (verified via their
//      own JWT, never a client-supplied tenant_id).
//   2. Looks up the given role by name for that tenant (or accepts the
//      built-in 'admin' role, which is not a row in `roles` and maps to
//      unrestricted access) to get its permission set.
//   3. If the email already has an account, just adds a tenant_memberships
//      row for them with that role's permissions copied in (no new
//      invite email sent -- they can already sign in).
//   4. If the email is new, calls supabase.auth.admin.inviteUserByEmail
//      (sends Supabase's own invite email with a link to set a password)
//      and creates the tenant_memberships row for the resulting user id,
//      already carrying the chosen role's permissions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'invalid_session' }, 401);

  const { email, role_name } = await req.json();
  if (!email || !role_name) return json({ error: 'invalid_request', message: 'email and role_name are required.' }, 400);

  const db = createClient(supabaseUrl, serviceRoleKey);

  // Only the tenant's owner may invite -- verified server-side, not
  // trusted from the request.
  const { data: tenant } = await db.from('tenants').select('id').eq('owner_user_id', userData.user.id).maybeSingle();
  if (!tenant) return json({ error: 'not_tenant_owner', message: 'Only the institution owner can invite team members.' }, 403);

  let permissions: Record<string, boolean> = {};
  if (role_name !== 'admin') {
    const { data: roleRow } = await db.from('roles').select('permissions').eq('tenant_id', tenant.id).eq('name', role_name).maybeSingle();
    if (!roleRow) return json({ error: 'role_not_found', message: `No role named "${role_name}" for this institution.` }, 404);
    permissions = roleRow.permissions ?? {};
  }

  // Does this email already have an account?
  const { data: existingProfile } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  let userId: string;

  if (existingProfile) {
    userId = existingProfile.id;
  } else {
    const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(email);
    if (inviteErr || !invited.user) return json({ error: 'invite_failed', message: inviteErr?.message }, 500);
    userId = invited.user.id;
  }

  const { data: existingMembership } = await db.from('tenant_memberships').select('id').eq('tenant_id', tenant.id).eq('user_id', userId).maybeSingle();
  if (existingMembership) {
    await db.from('tenant_memberships').update({ role: role_name, permissions }).eq('id', existingMembership.id);
    return json({ status: 'updated', user_id: userId });
  }

  await db.from('tenant_memberships').insert({ tenant_id: tenant.id, user_id: userId, role: role_name, permissions });
  return json({ status: existingProfile ? 'added' : 'invited', user_id: userId });
});
