-- 225_fix_rls_referidos.sql

-- Dar acceso total a los administradores
DROP POLICY IF EXISTS "Admins can do everything on referidos_objetivos" ON public.referidos_objetivos;
CREATE POLICY "Admins can do everything on referidos_objetivos" ON public.referidos_objetivos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() 
    AND rol IN ('admin', 'administrador', 'superadmin', 'empleado')
  )
);

-- Para recompensas canjeadas (admin puede ver todo)
DROP POLICY IF EXISTS "Admins can view referidos_recompensas_canjeadas" ON public.referidos_recompensas_canjeadas;
CREATE POLICY "Admins can view referidos_recompensas_canjeadas" ON public.referidos_recompensas_canjeadas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() 
    AND rol IN ('admin', 'administrador', 'superadmin', 'empleado')
  )
);
