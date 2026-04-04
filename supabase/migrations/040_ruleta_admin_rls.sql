-- ============================================================
-- Migración 040: Corrección de RLS para Administración
-- ============================================================

-- 1. Permitir que los administradores inserten registros en el historial de otros
CREATE POLICY "giros_admin_all" ON public.ruleta_giros
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  );

-- 2. Asegurar que los admins puedan ver y modificar giros disponibles de todos
DROP POLICY IF EXISTS "giros_disp_admin_all" ON public.ruleta_giros_disponibles;
CREATE POLICY "giros_disp_admin_all" ON public.ruleta_giros_disponibles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  );

-- 3. Asegurar que los admins puedan gestionar cualquier billetera (Saldo USD/Bs)
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.billeteras;
CREATE POLICY "Admins can view and manage all wallets" ON public.billeteras
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND LOWER(rol) = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND LOWER(rol) = 'admin'
        )
    );

-- 4. Recargar caché de esquema
NOTIFY pgrst, 'reload schema';
