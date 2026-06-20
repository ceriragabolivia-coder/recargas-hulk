
-- Migración 087: Corrección Final de Políticas RLS para Perfiles
-- Esta migración soluciona el error "new row violates row-level security policy" al asignar roles.

-- 1. Optimizar y robustecer funciones de verificación
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  -- Permite tanto 'admin' como 'administrador'
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() 
    AND LOWER(rol) IN ('admin', 'administrador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  -- Uso de auth.jwt() es más confiable y no requiere permisos sobre el esquema auth
  RETURN (auth.jwt() ->> 'email') = 'recargashulk@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpieza de todas las políticas existentes en perfiles para evitar conflictos
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'perfiles' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Crear Políticas Robustas

-- A. SuperAdmin Bypass (Acceso Total)
CREATE POLICY "Perfiles: SuperAdmin full access" 
ON public.perfiles FOR ALL 
TO authenticated 
USING (
    (auth.jwt() ->> 'email') = 'recargashulk@gmail.com'
    OR public.is_superadmin()
)
WITH CHECK (
    (auth.jwt() ->> 'email') = 'recargashulk@gmail.com'
    OR public.is_superadmin()
);

-- B. Admins Generales (Gestión de otros usuarios)
CREATE POLICY "Perfiles: admin management" 
ON public.perfiles FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- C. Usuarios Autenticados (Ver su propio perfil e insertar el inicial)
CREATE POLICY "Perfiles: user self access" 
ON public.perfiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Perfiles: user self insert" 
ON public.perfiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 4. Asegurar RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 5. Recargar esquema
NOTIFY pgrst, 'reload schema';
