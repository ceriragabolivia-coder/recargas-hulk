-- Migration: 076_fix_configuracion_logic.sql
-- Description: Corrige la lógica de configuración para permitir multi-tenant y roles insensibles a mayúsculas.

-- 1. Corregir restricciones de la tabla configuracion
DO $$ 
BEGIN
    -- Eliminar la restricción global restrictiva que impide configuraciones por dueño
    ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;

    -- Asegurar que existe la restricción compuesta (clave, owner_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'configuracion_clave_owner_key'
    ) THEN
        ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_owner_key UNIQUE (clave, owner_id);
    END IF;
END $$;

-- 2. Crear un índice único parcial para la configuración global (donde owner_id es NULL)
-- Esto asegura que solo haya un registro global por cada clave, ya que UNIQUE(clave, owner_id)
-- trata los NULLs como valores distintos.
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_global_unique_idx ON public.configuracion (clave) WHERE owner_id IS NULL;

-- 3. Actualizar función is_admin() para ser más robusta
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() 
    AND LOWER(rol) IN ('admin', 'administrador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar función is_superadmin() para ser insensible a mayúsculas
CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND LOWER(email) = 'recargashulk@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recargar esquema para PostgREST
NOTIFY pgrst, 'reload schema';
