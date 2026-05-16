
-- Migración 117: Corrección de RLS para Soporte - Respuestas Rápidas
-- Esta migración asegura que administradores y superadmins puedan gestionar respuestas rápidas.

-- 1. Eliminar políticas antiguas que causan el error 403
DROP POLICY IF EXISTS "Admins pueden todo en respuestas rápidas" ON public.soporte_respuestas_rapidas;
DROP POLICY IF EXISTS "Clientes pueden ver respuestas rápidas" ON public.soporte_respuestas_rapidas;

-- 2. Crear Política Administrativa (Gestión Total)
CREATE POLICY "soporte_respuestas_rapidas_admin_all" 
ON public.soporte_respuestas_rapidas
FOR ALL 
TO authenticated 
USING (
    public.is_admin() OR public.is_superadmin()
)
WITH CHECK (
    public.is_admin() OR public.is_superadmin()
);

-- 3. Crear Política de Lectura Universal (Para que todos los staff puedan verlas)
-- Incluimos a 'negocio' y 'empleado' si es necesario, pero public.is_admin() ya suele cubrir staff.
-- Sin embargo, para mayor flexibilidad en el chat, permitimos que cualquier autenticado las lea.
CREATE POLICY "soporte_respuestas_rapidas_read_all" 
ON public.soporte_respuestas_rapidas
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Recargar esquema para aplicar cambios
NOTIFY pgrst, 'reload schema';
