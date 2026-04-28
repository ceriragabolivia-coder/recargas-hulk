
-- Migración 080: Blindaje y Flexibilidad de Políticas de Perfiles
-- Esta migración asegura que el SuperAdmin siempre tenga acceso y permite la auto-creación de perfiles.

-- 1. Limpieza profunda de políticas previas en perfiles
DROP POLICY IF EXISTS "Perfiles: ver propio" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin gestion total" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin select" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin insert" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin update" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin delete" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: SuperAdmin bypass" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: auto-insert inicial" ON public.perfiles;

-- 2. Política: Ver propio perfil (lectura)
CREATE POLICY "Perfiles: ver propio" 
ON public.perfiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 3. Política: Auto-inserción inicial (necesaria para el registro/primer login)
-- Permite insertar si el ID del nuevo registro coincide con el del usuario autenticado
CREATE POLICY "Perfiles: auto-insert inicial" 
ON public.perfiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 4. Política: SuperAdmin Bypass (ceriraga@gmail.com)
-- Acceso total garantizado por email de auth.users, evitando dependencias circulares de la tabla perfiles
CREATE POLICY "Perfiles: SuperAdmin bypass" 
ON public.perfiles FOR ALL 
TO authenticated 
USING (
    (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()) = 'ceriraga@gmail.com'
)
WITH CHECK (
    (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()) = 'ceriraga@gmail.com'
);

-- 5. Políticas: Administradores generales (vía función is_admin)
-- Se definen explícitamente para cada operación para asegurar que PostgREST las reconozca correctamente
CREATE POLICY "Perfiles: admin select" ON public.perfiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Perfiles: admin insert" ON public.perfiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Perfiles: admin update" ON public.perfiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Perfiles: admin delete" ON public.perfiles FOR DELETE TO authenticated USING (public.is_admin());

-- 6. Recargar esquema
NOTIFY pgrst, 'reload schema';
