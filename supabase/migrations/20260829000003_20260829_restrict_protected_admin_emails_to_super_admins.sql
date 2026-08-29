/*
# Restrict protected_admin_emails to super admins only

protected_admin_emails was readable (qual = true) by every authenticated
user, and src/lib/auth.tsx fetched it unconditionally on every login
(not just for super admins) for a purely cosmetic UI check inside the
Super Admin panel. This meant every tenant staff member's browser held
the exact email addresses of the platform's super admin accounts --
unnecessary reconnaissance value for anyone targeting those accounts
with phishing or credential-stuffing. handle_new_user() (which actually
USES this table to decide is_super_admin at signup) is SECURITY DEFINER
and bypasses RLS entirely, so it is unaffected by restricting SELECT
here. The frontend fetch was also moved to only run for confirmed super
admins (see src/lib/auth.tsx).

Applied directly to the live database via the Supabase connector; this
file brings the repo's migration history in sync with that.
*/

DROP POLICY IF EXISTS "pae_select" ON protected_admin_emails;
CREATE POLICY "pae_select" ON protected_admin_emails FOR SELECT TO authenticated USING (is_super_admin());
