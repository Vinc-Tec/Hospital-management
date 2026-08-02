// Appointment reminders via SMS / WhatsApp (Twilio)
//
// STATUS: the logic here is real and complete, but it is INACTIVE until
// you provide Twilio credentials. Without them, this function returns a
// clear 'not_configured' response and sends nothing -- it never fails
// silently or fakes success.
//
// SETUP (once you have a Twilio account):
//   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
//   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxx
//   supabase secrets set TWILIO_FROM=+1415XXXXXXX          (SMS sender number)
//   supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+1415XXXXXXX  (optional, for WhatsApp Business)
//   supabase functions deploy send-appointment-reminders
//
// IMPORTANT -- WhatsApp specifically requires a pre-approved template:
// unlike SMS, Meta does not allow a business to send free-form text as
// the FIRST message of a conversation (i.e. a reminder the patient isn't
// actively replying to, outside any existing 24h session window). You
// must create a message template in the Twilio Console (Messaging >
// Content Template Builder), submit it for WhatsApp approval via Meta
// (typically takes a few hours to a couple of days the first time), and
// then set:
//   supabase secrets set TWILIO_WHATSAPP_TEMPLATE_SID=HXxxxxxxxx
// The template's body must have exactly one variable placeholder, e.g.:
//   "Reminder: {{1}}"
// This function fills that single variable with the full reminder text
// it already builds. If TWILIO_WHATSAPP_FROM is set but
// TWILIO_WHATSAPP_TEMPLATE_SID is not, this function will NOT attempt to
// send via WhatsApp (Meta would reject a free-form send anyway) -- it
// falls back to SMS if TWILIO_FROM is configured, or reports
// 'not_configured' for that channel otherwise. This avoids silently
// sending something Meta will just reject, or worse, appearing to
// succeed while actually failing per-recipient.
//
// This function does not schedule itself -- it needs to be called
// periodically (every 15-30 min is reasonable) by either:
//   - Supabase's built-in Cron Jobs (Database > Cron Jobs in the
//     dashboard, calling this function's URL), or
//   - an external scheduler (e.g. a cron job on your own server, or a
//     free-tier scheduler like cron-job.org) hitting the function URL
//     with the appropriate auth header.
//
// Each run: finds appointments in the next ~24h that haven't had a
// reminder sent yet, sends one SMS (or WhatsApp template message, if
// properly configured) per appointment to the patient's phone number,
// and marks appointments.reminder_sent_at so it's never sent twice.
// Tenants without a phone number on file are simply skipped (no error).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

Deno.serve(async () => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const smsFrom = Deno.env.get('TWILIO_FROM');
  const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM');
  const whatsappTemplateSid = Deno.env.get('TWILIO_WHATSAPP_TEMPLATE_SID');

  // WhatsApp is only usable once a template SID is actually configured --
  // sending free-form via WhatsApp for a reminder Meta considers
  // business-initiated would just be rejected per-recipient.
  const canWhatsapp = !!whatsappFrom && !!whatsappTemplateSid;
  const canSms = !!smsFrom;

  if (!accountSid || !authToken || !(canSms || canWhatsapp)) {
    return new Response(JSON.stringify({
      status: 'not_configured',
      message: 'No usable channel configured. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, and either TWILIO_FROM (for SMS) or both TWILIO_WHATSAPP_FROM + TWILIO_WHATSAPP_TEMPLATE_SID (for WhatsApp, which requires a Meta-approved template -- see this file\u2019s header comment).',
      whatsapp_from_set: !!whatsappFrom,
      whatsapp_template_configured: canWhatsapp,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const windowStart = new Date().toISOString();
  const windowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: appointments, error } = await db
    .from('appointments')
    .select('id, scheduled_at, reason, patient_id, patients(first_name, last_name, phone), tenants(commercial_name, legal_name)')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)
    .in('status', ['scheduled', 'confirmed']);

  if (error) return new Response(JSON.stringify({ status: 'error', message: error.message }), { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const appt of appointments ?? []) {
    const patient = (appt as any).patients;
    const tenant = (appt as any).tenants;
    const phone = patient?.phone;
    if (!phone) { skipped++; continue; }

    const time = new Date(appt.scheduled_at).toLocaleString();
    const institutionName = tenant?.commercial_name || tenant?.legal_name || 'your healthcare provider';
    const message = `Reminder: you have an appointment at ${institutionName} on ${time}.${appt.reason ? ' Reason: ' + appt.reason : ''}`;

    // Prefer WhatsApp only when it's actually properly configured (a
    // real approved template, not just a from-number); otherwise use SMS.
    const useWhatsapp = canWhatsapp;
    if (!useWhatsapp && !canSms) { skipped++; continue; }

    const to = useWhatsapp ? `whatsapp:${phone}` : phone;
    const from = useWhatsapp ? whatsappFrom! : smsFrom!;

    const params = useWhatsapp
      // WhatsApp business-initiated messages must use a pre-approved
      // Content Template, not free-form Body text. The template is
      // expected to have exactly one variable ({{1}}) that this fills
      // with the same reminder text used for SMS.
      ? new URLSearchParams({ To: to, From: from, ContentSid: whatsappTemplateSid!, ContentVariables: JSON.stringify({ '1': message }) })
      : new URLSearchParams({ To: to, From: from, Body: message });

    const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
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
