
-- Function to handle new user registration: create profile + mark super admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_protected_admin boolean;
BEGIN
  -- Check if this email is a protected super admin
  is_protected_admin := lower(NEW.email) IN (
    'vincentnogue2@gmail.com',
    'vincentnogue@yahoo.com',
    'webdxb1@gmail.com',
    'liyahjoha@gmail.com'
  );

  -- Insert profile with super_admin flag if protected
  INSERT INTO public.profiles (id, full_name, is_super_admin, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    is_protected_admin,
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill emails for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
