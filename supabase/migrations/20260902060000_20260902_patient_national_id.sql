/*
  Patients had no field to record a national ID / identity document
  number -- important for a real hospital record (matching insurance
  claims, avoiding duplicate patient records, legal identification).
*/

ALTER TABLE patients ADD COLUMN IF NOT EXISTS national_id text;
CREATE INDEX IF NOT EXISTS patients_national_id_idx ON patients(tenant_id, national_id) WHERE national_id IS NOT NULL;
