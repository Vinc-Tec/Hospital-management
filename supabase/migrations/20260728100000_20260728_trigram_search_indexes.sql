/*
# Trigram indexes for search performance at scale

## Why
ModulePage's search box now runs server-side ILIKE '%term%' queries
(via usePaginatedCrud) instead of loading every row and filtering in the
browser. A plain ILIKE '%term%' with a leading wildcard cannot use a
standard btree index -- Postgres falls back to a full table scan. That's
fine at hundreds of rows per tenant; it is not fine at the scale this
platform is aiming for.

pg_trgm (trigram) GIN indexes let Postgres answer ILIKE '%term%' queries
efficiently regardless of table size. This targets the columns actually
used as searchable fields in the highest-row-count modules: patients,
doctors, staff, and invoices.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Matches the actual query pattern: usePaginatedCrud builds separate
-- "column.ilike.%term%" conditions combined with OR, one per searchable
-- column -- NOT a concatenated "first_name || last_name" expression. The
-- index must be on the individual columns to actually be used.
CREATE INDEX IF NOT EXISTS patients_first_name_trgm_idx ON patients USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_last_name_trgm_idx ON patients USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_phone_trgm_idx ON patients USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_email_trgm_idx ON patients USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS doctors_first_name_trgm_idx ON doctors USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS doctors_last_name_trgm_idx ON doctors USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS staff_first_name_trgm_idx ON staff USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS staff_last_name_trgm_idx ON staff USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS invoices_number_trgm_idx ON invoices USING gin (invoice_number gin_trgm_ops);
