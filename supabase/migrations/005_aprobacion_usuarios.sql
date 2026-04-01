-- Migration: Sistema de Aprobación de Usuarios
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));

-- Asegurar que el administrador actual esté aprobado
UPDATE public.perfiles SET estado = 'aprobado' WHERE rol = 'admin';
UPDATE public.perfiles SET estado = 'aprobado' WHERE id IN (SELECT id FROM auth.users WHERE email = 'ceriraga@gmail.com');

-- Actualizar función del trigger para nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol, estado)
  VALUES (new.id, 'cliente', 'pendiente');
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Si un administrador crea un usuario manualmente desde el dashboard de Supabase, 
-- este trigger se encargará de ponerlo en 'pendiente' por defecto.
