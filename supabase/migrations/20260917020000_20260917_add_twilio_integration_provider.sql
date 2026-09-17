/*
  Add 'twilio' as a per-tenant connectable integration provider.

  Appointment reminders (SMS/WhatsApp) previously relied on ONE global
  Twilio account shared across every tenant, configured via Edge
  Function secrets. That doesn't scale to a multi-tenant platform of
  "international renown" -- each clinic should sender-brand its own
  messages and pay for its own usage. This lets each tenant connect
  their own Twilio account from Settings > Integrations, exactly like
  they already do for WhatsApp (Meta) and Telegram.

  See supabase/functions/send-appointment-reminders/index.ts for the
  per-tenant config it now reads: { account_sid, auth_token, from,
  whatsapp_from?, whatsapp_template_sid? }.
*/

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('whatsapp', 'sms', 'google_calendar', 'slack', 'flutterwave', 'webhook_generic', 'telegram', 'stripe', 'paystack', 'zapier', 'twilio'));
