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
// This function does not schedule itself -- it needs to be called
// periodically (every 15-30 min is reasonable) by either:
//   - Supabase's built-in Cron Jobs (Database > Cron Jobs in the
//     dashboard, calling this function's URL), or
//   - an external scheduler (e.g. a cron job on your own server, or a
//     free-tier scheduler like cron-job.org) hitting the function URL
//     with the appropriate auth header.
//
// Each run: finds appointments in the next ~24h that haven't had a
// reminder sent yet, sends one SMS (or WhatsApp message if
// TWILIO_WHATSAPP_FROM is set) per appointment to the patient's phone
// number, and marks appointments.reminder_sent_at so it's never sent
// twice. Tenants without a phone number on file, or without the
// 'telemedicine'-tier plan feature this might eventually be gated
// behind, are simply skipped (no error) -- this endpoint currently
// applies to all tenants; add a module_flags check here if you want to
// restrict reminders to specific plans later.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

Deno.serve(async () => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const smsFrom = Deno.env.get('TWILIO_FROM');
  const whatsappFrom = Deno.env.get('TWILIO_WHATSAPP_FROM');

  if (!accountSid || !authToken || !(smsFrom || whatsappFrom)) {
    return new Response(JSON.stringify({
      status: 'not_configured',
      message: 'Twilio credentials are not set. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM (and/or TWILIO_WHATSAPP_FROM) as function secrets before this can send anything.',
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

    const useWhatsapp = !!whatsappFrom;
    const to = useWhatsapp ? `whatsapp:${phone}` : phone;
    const from = useWhatsapp ? whatsappFrom! : smsFrom!;

    const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }),
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
