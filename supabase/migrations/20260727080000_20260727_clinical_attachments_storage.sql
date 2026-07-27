/*
# Real file attachments for lab / radiology reports

## Why
Lab and radiology results were stored as free text only (`result`,
`report` columns) -- no way to attach an actual scanned document, PDF, or
image. This uses Supabase Storage, which is already part of the same
Supabase project (no new third-party account needed).

This is NOT a DICOM/PACS server or medical imaging viewer -- it is plain
file storage (any image/PDF) with tenant-scoped access control, wired to
the existing Lab and Radiology modules.

## Isolation
Files are stored under a path prefixed with the tenant's UUID
("<tenant_id>/lab/<file>" or "<tenant_id>/radiology/<file>"). Access is
restricted by checking tenant_memberships against that first path segment,
exactly mirroring the isolation model used everywhere else in the schema.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-attachments', 'clinical-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "clinical_attachments_select" ON storage.objects;
CREATE POLICY "clinical_attachments_select" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'clinical-attachments'
  AND EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);
DROP POLICY IF EXISTS "clinical_attachments_insert" ON storage.objects;
CREATE POLICY "clinical_attachments_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'clinical-attachments'
  AND EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);
DROP POLICY IF EXISTS "clinical_attachments_update" ON storage.objects;
CREATE POLICY "clinical_attachments_update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'clinical-attachments'
  AND EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);
DROP POLICY IF EXISTS "clinical_attachments_delete" ON storage.objects;
CREATE POLICY "clinical_attachments_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'clinical-attachments'
  AND EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS attachment_path text;
