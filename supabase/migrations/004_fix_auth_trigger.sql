-- 004_fix_auth_trigger.sql
-- Fixes the handle_new_user trigger to explicitly target the public schema.
-- This prevents "Database error saving new user" when Supabase Auth (which runs in the auth schema)
-- tries to fire the trigger without a set search_path.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name;
  
  RETURN NEW;
END;
$$;

COMMIT;
