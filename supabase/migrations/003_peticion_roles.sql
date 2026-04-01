-- Migration: Auth Roles and Profile Linking
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    rol TEXT DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Link clientes table to Auth
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Perfiles: ver propio" ON public.perfiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Perfiles: admin ve todos" ON public.perfiles FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Trigger to auto-create profile for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol)
  VALUES (new.id, 'cliente');
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    END IF;
END $$;

-- IMPORTANT: Manual step for the existing user
-- UPDATE perfiles SET rol = 'admin' WHERE id = 'USUARIO_ACTUAL_ID';
