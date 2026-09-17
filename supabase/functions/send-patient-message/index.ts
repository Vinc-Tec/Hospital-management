// send-patient-message -- lets staff message a patient (SMS or
// WhatsApp) directly from the Patients module, using THAT tenant's own
// connected Twilio account (Settings > Integrations > Twilio -- the
// same one send-appointment-reminders uses for automated reminders).
//
// STATUS: real and complete for SMS, which Twilio allows as free-form
// text at any time. WhatsApp is only attempted if the tenant has BOTH
// whatsapp_from AND whatsapp_template_sid configured, and even then it
// sends the tenant's typed text through that pre-approved template's
// single variable -- exactly like send-appointment-reminders. This is
// a real constraint of WhatsApp Business messaging (see that
// function's header comment for why), not a shortcut taken here: Meta
// does not allow arbitrary free-form text as a business-initiated
// message outside an active 24h customer conversation window, so a
// "type anything, send via WhatsApp" button would silently fail for
// most messages if it didn't route through a template.
//
// SECURITY: runs under the CALLER's own JWT (not service role) --
// every query below is subject to the exact same RLS as the rest of
// the app, so this can only ever send on behalf of a tenant the caller
// is actually a member of, to a patient that actually belongs to that
// tenant. No cross-tenant access is possible even in principle.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// PhoneInput (see src/components/ui.tsx) stores "+225 0700000000" -- a
// space after the dial code for readability -- but Twilio's API
// requires strict E.164 with no whitespace.
function toE164(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned || undefined;
}

type Payload = { patient_id: string; channel: 'sms' | 'whatsapp'; message: string };

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
  if (!body.patient_id || !body.channel || !body.message?.trim()) {
    return json({ error: 'patient_id, channel and message are required' }, 400);
  }
  if (body.message.length > 1000) return json({ error: 'message is too long (max 1000 characters)' }, 400);
  if (body.channel !== 'sms' && body.channel !== 'whatsapp') return json({ error: 'channel must be sms or whatsapp' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: userData, error: userErr } = await db.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'invalid_session' }, 401);

  const { data: patient, error: patientErr } = await db.from('patients').select('id, tenant_id, first_name, last_name, phone').eq('id', body.patient_id).maybeSingle();
  if (patientErr || !patient) return json({ error: 'patient_not_found' }, 404);

  const phone = toE164(patient.phone as string | null);
  if (!phone) return json({ error: 'patient_has_no_phone' }, 400);

  const { data: twilio } = await db.from('integrations').select('config').eq('tenant_id', patient.tenant_id).eq('provider', 'twilio').eq('status', 'active').maybeSingle();
  const config = (twilio?.config as { account_sid?: string; auth_token?: string; from?: string; whatsapp_from?: string; whatsapp_template_sid?: string } | null) ?? null;

  if (!config?.account_sid || !config?.auth_token) {
    return json({ error: 'twilio_not_connected', message: 'Connect Twilio from Settings > Integrations first.' }, 400);
  }

  const smsFrom = toE164(config.from);
  const whatsappFrom = toE164(config.whatsapp_from);
  const canWhatsapp = !!whatsappFrom && !!config.whatsapp_template_sid;

  if (body.channel === 'whatsapp' && !canWhatsapp) {
    return json({ error: 'whatsapp_not_configured', message: 'WhatsApp needs a sender number AND an approved template SID -- see Settings > Integrations > Twilio.' }, 400);
  }
  if (body.channel === 'sms' && !smsFrom) {
    return json({ error: 'sms_not_configured', message: 'No SMS sender number set for Twilio.' }, 400);
  }

  const message = body.message.trim();
  const useWhatsapp = body.channel === 'whatsapp';
  const to = useWhatsapp ? `whatsapp:${phone}` : phone;
  const from = useWhatsapp ? `whatsapp:${whatsappFrom}` : smsFrom!;

  const params = useWhatsapp
    ? new URLSearchParams({ To: to, From: from, ContentSid: config.whatsapp_template_sid!, ContentVariables: JSON.stringify({ '1': message }) })
    : new URLSearchParams({ To: to, From: from, Body: message });

  const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.account_sid}:${config.auth_token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const ok = twilioResp.ok;
  const errorText = ok ? null : await twilioResp.text();

  await db.from('patient_messages').insert({
    tenant_id: patient.tenant_id,
    patient_id: patient.id,
    channel: body.channel,
    message,
    status: ok ? 'sent' : 'failed',
    error: errorText,
    sent_by: userData.user.id,
    sent_by_name: userData.user.email ?? null,
  });

  if (!ok) return json({ error: 'twilio_error', message: errorText }, 502);
  return json({ status: 'sent' });
});
