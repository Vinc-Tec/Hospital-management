/*
# New module: Patient Queue (real-time front-desk <-> doctor handoff)

## Why
Front-desk/cash-desk registers or checks in a patient, but nothing told a
doctor's dashboard that a patient is now waiting for them -- the app had
zero real-time capability anywhere (no `.channel()` usage, no table added
to `supabase_realtime`), so a doctor only ever saw new patients on their
own next manual page refresh. For a premium multi-department hospital
platform this is a coherence gap: reception and clinical staff must see
the same live state.

## What this adds
1. `patient_queue`: one row per patient currently checked in and waiting
   to be (or being) seen. `status` moves waiting -> in_consultation ->
   completed (or cancelled). Optional `doctor_id` lets reception route to
   a specific doctor, or leave it unassigned for "any available doctor".
   Optional `appointment_id` links back to a scheduled appointment when
   the check-in follows one, without requiring it (walk-ins are just as
   valid).
2. Row Level Security mirroring the integrations/webhooks module pattern
   exactly (tenant membership + tenant_module_enabled, super-admin
   bypass) -- see 20260824_integrations_module.sql.
3. `patient_queue` is added to the `supabase_realtime` publication so the
   frontend can subscribe with `supabase.channel(...).on('postgres_changes', ...)`
   and get pushed updates the instant reception inserts or updates a row
   -- this is the first real-time-enabled table in the schema.
4. New `queue` module flag, enabled for ALL plans including starter:
   this is core patient-flow coherence (same tier as patients/
   appointments/doctors), not a premium upsell.

## Security
RLS enabled with the same authority model used everywhere else in this
schema (tenant_memberships + tenant_module_enabled + is_super_admin()).
No changes to any existing table's policies.
*/

-- ============================================================
-- 1. patient_queue table
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_consultation', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  reason text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_queue_tenant_status_idx ON patient_queue(tenant_id, status, checked_in_at);
CREATE INDEX IF NOT EXISTS patient_queue_tenant_doctor_idx ON patient_queue(tenant_id, doctor_id);
CREATE INDEX IF NOT EXISTS patient_queue_patient_idx ON patient_queue(patient_id);

ALTER TABLE patient_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_queue_select" ON patient_queue;
CREATE POLICY "patient_queue_select" ON patient_queue FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patient_queue.tenant_id)
    AND tenant_module_enabled(patient_queue.tenant_id, 'queue')
  )
);
DROP POLICY IF EXISTS "patient_queue_insert" ON patient_queue;
CREATE POLICY "patient_queue_insert" ON patient_queue FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR (
    EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patient_queue.tenant_id)
    AND tenant_module_enabled(patient_queue.tenant_id, 'queue')
  )
);
DROP POLICY IF EXISTS "patient_queue_update" ON patient_queue;
CREATE POLICY "patient_queue_update" ON patient_queue FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patient_queue.tenant_id)
) WITH CHECK (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patient_queue.tenant_id)
);
DROP POLICY IF EXISTS "patient_queue_delete" ON patient_queue;
CREATE POLICY "patient_queue_delete" ON patient_queue FOR DELETE TO authenticated USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = patient_queue.tenant_id)
);

-- ============================================================
-- 2. Enable real-time change streaming for this table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'patient_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE patient_queue;
  END IF;
END $$;

-- ============================================================
-- 3. Module flag: 'queue', enabled for every plan (core coherence,
--    not a premium tier feature -- same treatment as patients/
--    appointments/doctors/invoices/reports).
-- ============================================================
UPDATE subscription_plans SET module_flags = module_flags || '{"queue": true}'::jsonb;
