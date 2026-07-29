/*
# Appointment reminder tracking

Adds a column to record when an SMS/WhatsApp reminder was sent for an
appointment, so the reminder function (send-appointment-reminders Edge
Function) never sends the same reminder twice. See that function's
header comment for the full picture -- it requires a Twilio account to
actually send anything and does nothing until one is configured.
*/

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
