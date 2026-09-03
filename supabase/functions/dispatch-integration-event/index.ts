// dispatch-integration-event -- the function that makes a connected
// integration actually DO something.
//
// STATUS: real, complete logic for Slack (incoming webhook) and generic
// webhooks (the `webhooks` table) -- these work the moment a tenant
// connects them, no external app review needed. Telegram works once a
// tenant creates their own bot via @BotFather (a 1-minute, no-approval
// process) and pastes the bot token + chat id. WhatsApp delivery is
// intentionally NOT attempted here: sending a real WhatsApp Business
// message requires a Meta-approved message template and a
// phone_number_id issued after Meta's business verification, which is a
// per-tenant setup step (see PROVIDER_META in Integrations.tsx) that
// can't be faked -- attempting it with unverified credentials would
// silently fail against Meta's API and we'd rather log that
// truthfully than pretend it succeeded.
//
// Called from the authenticated frontend (ModulePage.tsx, and the
// "Send test message" button in Integrations.tsx) with the caller's own
// JWT, so every query below runs under the SAME row-level-security
// policies as the rest of the app -- this function can only ever see
// integrations/webhooks belonging to a tenant the caller is actually a
// member of. No service-role key is used.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Payload = { tenant_id: string; event: string; title: string; lines?: string[] };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body.tenant_id || !body.event || !body.title) {
    return json({ error: 'tenant_id, event and title are required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const results: Record<string, string> = {};

  // 1) Generic webhooks the tenant registered for this exact event (or 'all')
  const { data: hooks } = await supabase
    .from('webhooks')
    .select('id, name, url, secret')
    .eq('tenant_id', body.tenant_id)
    .eq('is_active', true)
    .in('event', [body.event, 'all']);

  for (const hook of hooks ?? []) {
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hook.secret ? { 'X-Webhook-Secret': hook.secret } : {}),
        },
        body: JSON.stringify({ event: body.event, title: body.title, lines: body.lines ?? [], sent_at: new Date().toISOString() }),
      });
      results[`webhook:${hook.name}`] = res.ok ? 'sent' : `http_${res.status}`;
    } catch (e) {
      results[`webhook:${hook.name}`] = `error: ${e instanceof Error ? e.message : 'unknown'}`;
    }
  }

  // 2) Slack, if connected -- a Slack "incoming webhook" URL is a plain
  // POST target the tenant generates themselves in their own Slack
  // workspace, so this needs no OAuth app review on our side.
  const { data: slack } = await supabase
    .from('integrations')
    .select('config')
    .eq('tenant_id', body.tenant_id)
    .eq('provider', 'slack')
    .eq('status', 'active')
    .maybeSingle();

  const slackUrl = (slack?.config as Record<string, string> | null)?.webhook_url;
  if (slackUrl) {
    try {
      const text = [`*${body.title}*`, ...(body.lines ?? [])].join('\n');
      const res = await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      results.slack = res.ok ? 'sent' : `http_${res.status}`;
    } catch (e) {
      results.slack = `error: ${e instanceof Error ? e.message : 'unknown'}`;
    }
  }

  // 3) Telegram, if connected -- Telegram bots need no app review either:
  // a tenant creates one via @BotFather in ~1 minute and pastes the
  // token + the chat id it should post to.
  const { data: telegram } = await supabase
    .from('integrations')
    .select('config')
    .eq('tenant_id', body.tenant_id)
    .eq('provider', 'telegram')
    .eq('status', 'active')
    .maybeSingle();

  const tgConfig = telegram?.config as Record<string, string> | null;
  if (tgConfig?.bot_token && tgConfig?.chat_id) {
    try {
      const text = [body.title, ...(body.lines ?? [])].join('\n');
      const res = await fetch(`https://api.telegram.org/bot${tgConfig.bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgConfig.chat_id, text }),
      });
      results.telegram = res.ok ? 'sent' : `http_${res.status}`;
    } catch (e) {
      results.telegram = `error: ${e instanceof Error ? e.message : 'unknown'}`;
    }
  }

  return json({ dispatched: Object.keys(results).length, results });
});
