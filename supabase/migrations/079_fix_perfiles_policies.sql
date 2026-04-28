
-- Migración 079: Corrección de Políticas de RLS para Perfiles
-- Esta migración resuelve la recursión infinita y la sensibilidad a mayúsculas en las políticas de perfiles.

-- 1. Eliminar políticas antiguas e inseguras/recursivas
DROP POLICY IF EXISTS "Perfiles: ver propio" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin ve todos" ON public.perfiles;

-- 2. Crear nuevas políticas usando la función is_admin() robusta (definida en la migración 076)
-- La función is_admin() es SECURITY DEFINER, lo que evita la recursión al consultar la misma tabla.

-- Política: Los usuarios pueden ver su propio perfil
CREATE POLICY "Perfiles: ver propio" 
ON public.perfiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Política: Los administradores pueden realizar cualquier operación en todos los perfiles
CREATE POLICY "Perfiles: admin gestion total" 
ON public.perfiles 
FOR ALL 
TO authenticated 
USING (public.is_admin());

-- 3. Asegurar que la tabla tiene RLS activado (por si acaso)
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 4. Recargar esquema
NOTIFY pgrst, 'reload schema';
