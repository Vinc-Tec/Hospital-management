/*
  Add 'admin_extension' to subscription_event_type_enum.

  Used by the new Super Admin "Extend subscription" action
  (src/pages/SuperAdmin.tsx, SaSubscriptions) so a manually-granted
  extension is auditable as its own distinct event, separate from a
  real payment-driven subscription_created/renewed event -- important
  for telling "the customer paid" apart from "an admin granted this"
  when reviewing subscription_events later.
*/

ALTER TYPE subscription_event_type_enum ADD VALUE IF NOT EXISTS 'admin_extension';
