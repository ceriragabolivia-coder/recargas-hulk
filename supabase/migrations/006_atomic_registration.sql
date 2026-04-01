-- Migration: Atomic Registration Trigger
-- This ensures every new Auth user gets a profile AND a client entry automatically.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.perfiles (id, rol, estado)
  VALUES (new.id, 'cliente', 'pendiente');

  -- 2. Create Client record using metadata from the sign-up form
  INSERT INTO public.clientes (
    auth_user_id,
    usuario,
    nombres,
    apellidos,
    nickname,
    whatsapp,
    pais,
    estado,
    fecha_registro
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombres', ''),
    COALESCE(new.raw_user_meta_data->>'apellidos', ''),
    new.raw_user_meta_data->>'nickname',
    new.raw_user_meta_data->>'whatsapp',
    COALESCE(new.raw_user_meta_data->>'pais', 'Venezuela'),
    COALESCE(new.raw_user_meta_data->>'estado', ''),
    NOW()
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-sync existing users that have no client record but are in auth.users
-- This is a one-time fix for the users created during the sync issue.
INSERT INTO public.clientes (auth_user_id, usuario, nombres, apellidos, fecha_registro)
SELECT id, email, split_part(email, '@', 1), 'Sync', NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.auth_user_id = u.id)
ON CONFLICT (usuario) DO NOTHING;
