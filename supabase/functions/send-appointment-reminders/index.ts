// Appointment reminders via SMS / WhatsApp (Twilio) -- per-tenant
//
// STATUS: real and complete. Each tenant connects their OWN Twilio
// account from Settings > Integrations (provider 'twilio') -- there is
// no shared/global Twilio account. A tenant with no active 'twilio'
// integration is simply skipped (no error): reminders activate
// per-tenant the moment they connect their own credentials, with zero
// further deploy/config needed on our side.
//
// IMPORTANT -- WhatsApp specifically requires a pre-approved template:
// unlike SMS, Meta does not allow a business to send free-form text as
// the FIRST message of a conversation (i.e. a reminder the patient isn't
// actively replying to, outside any existing 24h session window). A
// tenant wanting WhatsApp reminders must create a message template in
// their own Twilio Console (Messaging > Content Template Builder),
// submit it for WhatsApp approval via Meta (typically a few hours to a
// couple of days the first time), and enter the resulting Content SID
// as `whatsapp_template_sid` alongside `whatsapp_from`. The template's
// body must have exactly one variable placeholder, e.g. "Reminder: {{1}}"
// -- this function fills that variable with the same reminder text used
// for SMS. If a tenant sets whatsapp_from without whatsapp_template_sid,
// this function does NOT attempt WhatsApp for them (Meta would reject a
// free-form send anyway) -- it falls back to SMS if `from` is set, or
// skips that tenant's reminders for that channel otherwise.
//
// SCHEDULING: this function does not schedule itself. See
// AGENTS.md ("Automation: billing housekeeping + reminders") -- a
// database Cron Job already calls this every 30 minutes.
//
// SECURITY: this function sends real messages (once a tenant connects
// Twilio) and must not be triggerable by arbitrary callers -- an open
// endpoint here would let anyone spam every tenant's patients on
// demand. It requires CRON_SECRET to be set as a function secret AND the
// caller to prove they know it via the X-Cron-Secret header, exactly
// like billing-housekeeping. If CRON_SECRET is unset, it refuses to run.
// It uses the service role (needed to read every tenant's appointments
// and integration credentials in one unattended run), so it is the ONLY
// code path allowed to read `integrations.config` across tenants --
// every other caller goes through RLS via the caller's own JWT.
//
// Each run: finds appointments in the next ~24h that haven't had a
// reminder sent yet, groups them by tenant, sends one SMS (or WhatsApp
// template message, if properly configured) per appointment to the
// patient's phone number using THAT tenant's own Twilio credentials, and
// marks appointments.reminder_sent_at so it's never sent twice. Patients
// without a phone number on file, or tenants without an active Twilio
// integration, are simply skipped (no error).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type TwilioConfig = {
  account_sid?: string; auth_token?: string; from?: string;
  whatsapp_from?: string; whatsapp_template_sid?: string;
};

// PhoneInput (see components/ui.tsx) stores "+225 0700000000" -- a space
// after the dial code for readability -- but Twilio's API requires
// strict E.164 with no whitespace. Every phone number that reaches
// Twilio (patient `To`, tenant's own `From`) goes through this first.
function toE164(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned || undefined;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return new Response(JSON.stringify({ status: 'not_configured', message: 'CRON_SECRET is not set. Set it as a function secret before scheduling reminders.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const provided = req.headers.get('x-cron-secret');
  if (!provided || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const windowStart = new Date().toISOString();
  const windowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: appointments, error } = await db
    .from('appointments')
    .select('id, tenant_id, scheduled_at, reason, patient_id, patients(first_name, last_name, phone), tenants(commercial_name, legal_name)')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)
    .in('status', ['scheduled', 'confirmed']);

  if (error) return new Response(JSON.stringify({ status: 'error', message: error.message }), { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const twilioCache = new Map<string, TwilioConfig | null>();

  async function getTwilioConfig(tenantId: string): Promise<TwilioConfig | null> {
    if (twilioCache.has(tenantId)) return twilioCache.get(tenantId)!;
    const { data } = await db.from('integrations').select('config').eq('tenant_id', tenantId).eq('provider', 'twilio').eq('status', 'active').maybeSingle();
    const config = (data?.config as TwilioConfig | null) ?? null;
    twilioCache.set(tenantId, config);
    return config;
  }

  for (const appt of appointments ?? []) {
    const patient = (appt as { patients?: { first_name?: string; last_name?: string; phone?: string } | null }).patients;
    const tenant = (appt as { tenants?: { commercial_name?: string; legal_name?: string } | null }).tenants;
    const phone = toE164(patient?.phone);
    if (!phone) { skipped++; continue; }

    const twilio = await getTwilioConfig(appt.tenant_id as string);
    if (!twilio?.account_sid || !twilio?.auth_token) { skipped++; continue; }

    const smsFrom = toE164(twilio.from);
    const whatsappFrom = toE164(twilio.whatsapp_from);
    const canWhatsapp = !!whatsappFrom && !!twilio.whatsapp_template_sid;
    const canSms = !!smsFrom;
    if (!canWhatsapp && !canSms) { skipped++; continue; }

    const time = new Date(appt.scheduled_at).toLocaleString();
    const institutionName = tenant?.commercial_name || tenant?.legal_name || 'your healthcare provider';
    const message = `Reminder: you have an appointment at ${institutionName} on ${time}.${appt.reason ? ' Reason: ' + appt.reason : ''}`;

    // Prefer WhatsApp only when it's actually properly configured (a
    // real approved template, not just a from-number); otherwise use SMS.
    const useWhatsapp = canWhatsapp;
    const to = useWhatsapp ? `whatsapp:${phone}` : phone;
    const from = useWhatsapp ? `whatsapp:${whatsappFrom}` : smsFrom!;

    const params = useWhatsapp
      // WhatsApp business-initiated messages must use a pre-approved
      // Content Template, not free-form Body text. The template is
      // expected to have exactly one variable ({{1}}) that this fills
      // with the same reminder text used for SMS.
      ? new URLSearchParams({ To: to, From: from, ContentSid: twilio.whatsapp_template_sid!, ContentVariables: JSON.stringify({ '1': message }) })
      : new URLSearchParams({ To: to, From: from, Body: message });

    const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.account_sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilio.account_sid}:${twilio.auth_token}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (twilioResp.ok) {
      await db.from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', appt.id);
      sent++;
    } else {
      const body = await twilioResp.text();
      errors.push(`appointment ${appt.id}: ${body}`);
    }
  }

  return new Response(JSON.stringify({ status: 'ok', sent, skipped, errors }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
