-- ============================================================
-- Migración 038: Diagnóstico de Visibilidad de Descuentos
-- ============================================================

-- 1. Asegurar que las políticas de RLS permiten ver los propios descuentos
-- incluso si el administrador está en modo "suplantación" o similar.
DROP POLICY IF EXISTS "rdp_own_select" ON public.ruleta_descuentos_pendientes;
CREATE POLICY "rdp_own_select" ON public.ruleta_descuentos_pendientes
  FOR SELECT USING (cliente_id = auth.uid());

-- 2. Asegurar que los admins pueden ver TODOS los descuentos para soporte técnico
DROP POLICY IF EXISTS "rdp_admin_all" ON public.ruleta_descuentos_pendientes;
CREATE POLICY "rdp_admin_all" ON public.ruleta_descuentos_pendientes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  );

-- 3. Función de diagnóstico: ¿Qué UUID tiene mi sesión actual?
-- Útil para comparar con el cliente_id de ruleta_descuentos_pendientes
CREATE OR REPLACE FUNCTION public.check_my_id()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN auth.uid();
END;
$$;
