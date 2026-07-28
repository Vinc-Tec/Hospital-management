/*
# Enforce file size and type limits on clinical attachments

## Why
The clinical-attachments bucket (lab/radiology file uploads) had no
server-side size or MIME-type limit -- a user could attempt to upload an
arbitrarily large file, or a file type never intended to be stored there.
Enforcing this at the bucket level (not just a UI hint) means it's a real
limit regardless of which client makes the upload request.
*/

UPDATE storage.buckets
SET
  file_size_limit = 20971520, -- 20 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'clinical-attachments';
