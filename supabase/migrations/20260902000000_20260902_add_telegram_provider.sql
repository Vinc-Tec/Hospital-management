/*
  Add 'telegram' as a connectable integration provider.

  Telegram bots need no OAuth app review: a tenant creates one via
  @BotFather in about a minute and pastes the resulting bot token plus
  the chat id it should post to. This is genuinely usable the moment a
  tenant connects it, unlike Google/Stripe-style OAuth integrations
  which need an app registered and reviewed on our side first (not yet
  built -- see src/pages/Integrations.tsx for the current honest state
  of each connector).
*/

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('whatsapp', 'sms', 'google_calendar', 'slack', 'flutterwave', 'webhook_generic', 'telegram'));
