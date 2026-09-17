/*
  patient_messages -- the audit trail + delivery record for the new
  "Send message" action on the Patients module (see
  supabase/functions/send-patient-message and
  src/components/PatientMessage.tsx). Every attempt is logged, sent or
  failed, so staff have a real history of what was communicated to a
  patient and through which channel -- not just a fire-and-forget send.
*/

CREATE TABLE IF NOT EXISTS patient_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_messages_patient_idx ON patient_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_messages_tenant_idx ON patient_messages(tenant_id, created_at DESC);

ALTER TABLE patient_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_messages_select" ON patient_messages;
CREATE POLICY "patient_messages_select" ON patient_messages FOR SELECT TO authenticated
  USING (is_super_admin() OR is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "patient_messages_insert" ON patient_messages;
CREATE POLICY "patient_messages_insert" ON patient_messages FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR is_tenant_member(tenant_id));

-- Same cross-tenant guard pattern as patient_payments: the patient
-- referenced must actually belong to the tenant on the row.
CREATE OR REPLACE FUNCTION validate_patient_message_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM patients WHERE id = NEW.patient_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'patient_messages.patient_id does not belong to patient_messages.tenant_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_patient_message_tenant ON patient_messages;
CREATE TRIGGER trg_validate_patient_message_tenant
BEFORE INSERT ON patient_messages
FOR EACH ROW EXECUTE FUNCTION validate_patient_message_tenant();
