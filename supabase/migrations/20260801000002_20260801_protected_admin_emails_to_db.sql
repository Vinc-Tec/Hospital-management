/*
# Move protected super-admin emails out of the frontend bundle

## Why
The list of protected super-admin emails was hardcoded in two frontend
files (src/lib/auth.tsx, src/pages/SuperAdmin.tsx) and shipped to every
browser. That leaks the platform operators' personal email addresses to
anyone who opens DevTools -- a ready-made phishing target -- and the
client-side `isProtectedSuperAdminEmail()` check is a UI convenience
only, not a security boundary.

## Fix
1. Add a `protected_admin_emails` table (admin-managed, RLS: everyone can
   SELECT the email column so the frontend can keep its cosmetic gate;
   only super admins can INSERT/UPDATE/DELETE). This keeps the addresses
   out of the static bundle while preserving existing behavior.
2. Seed it with the previously-hardcoded addresses.
3. Rewrite `handle_new_user()` to consult that table instead of an inline
   literal, so new sign-ups with a protected email still get auto-promoted
   server-side -- exactly as before, but now driven by data.
4. Backfill any existing auth user whose email is in the table to
   is_super_admin = true (matches the previous migration's backfill).

The frontend will be switched to reading `profiles.is_super_admin`
(which the DB already enforces) as the real authority, and to querying
this table for the cosmetic email gate -- removing the literals entirely.
*/

CREATE TABLE IF NOT EXISTS protected_admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protected_admin_emails ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated may read the email list (the frontend needs it to
-- keep its cosmetic isProtectedSuperAdminEmail check working without
-- hardcoding). The emails are operator addresses, not secrets, and the
-- real authorization is profiles.is_super_admin enforced server-side.
DROP POLICY IF EXISTS "pae_select" ON protected_admin_emails;
CREATE POLICY "pae_select" ON protected_admin_emails FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pae_insert" ON protected_admin_emails;
CREATE POLICY "pae_insert" ON protected_admin_emails FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "pae_update" ON protected_admin_emails;
CREATE POLICY "pae_update" ON protected_admin_emails FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "pae_delete" ON protected_admin_emails;
CREATE POLICY "pae_delete" ON protected_admin_emails FOR DELETE TO authenticated USING (is_super_admin());

-- Seed the previously-hardcoded list so behavior is preserved.
INSERT INTO protected_admin_emails (email)
SELECT lower(e) FROM (VALUES
  ('vincentnogue2@gmail.com'),
  ('vincentnogue@yahoo.com'),
  ('webdxb1@gmail.com'),
  ('liyahjoha@gmail.com')
) AS t(e)
ON CONFLICT (email) DO NOTHING;

-- Rewrite the new-user trigger to use the table instead of a literal.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_protected_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM protected_admin_emails WHERE lower(email) = lower(NEW.email)
  ) INTO is_protected_admin;

  INSERT INTO public.profiles (id, full_name, is_super_admin, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    is_protected_admin,
    NEW.email
  );

  RETURN NEW;
END;
$$;

-- Backfill: any existing user whose email is now protected gets promoted
-- (idempotent -- only flips rows that are currently false).
UPDATE public.profiles p
SET is_super_admin = true
FROM auth.users u, protected_admin_emails e
WHERE p.id = u.id AND lower(u.email) = lower(e.email) AND p.is_super_admin = false;
