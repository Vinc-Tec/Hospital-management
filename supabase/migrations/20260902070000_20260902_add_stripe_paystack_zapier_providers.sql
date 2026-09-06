/*
  Adds three real, connectable integration providers:

  - stripe: secret key, for creating patient-facing payment links from
    the Cash Desk (server-side, since a secret key must never reach
    the browser).
  - paystack: secret key, same purpose as Stripe -- a widely used PSP
    across Nigeria and other African markets Health Cloud serves.
  - zapier: a single "Zap webhook URL" the tenant creates on their own
    Zapier account. Needs no OAuth app on our side (same reasoning as
    Slack/Telegram in the earlier integrations migration) -- Zapier's
    own "Webhooks by Zapier" trigger just needs a POST target, which
    dispatch-integration-event already knows how to call generically
    for any webhook-style provider.
*/

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('whatsapp', 'sms', 'google_calendar', 'slack', 'flutterwave', 'webhook_generic', 'telegram', 'stripe', 'paystack', 'zapier'));
