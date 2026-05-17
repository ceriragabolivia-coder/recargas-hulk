-- ============================================================
-- Migración 122: Fix RLS para Tablas de Billeteras
-- Descripción: Permite a los roles admin, administrador y superadmin 
-- ver y gestionar billeteras usando las funciones globales is_admin() e is_superadmin()
-- ============================================================

-- 1. BILLETERAS
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.billeteras;
DROP POLICY IF EXISTS "Admins can manage all wallets" ON public.billeteras;
DROP POLICY IF EXISTS "Admins can view and manage all wallets" ON public.billeteras;

CREATE POLICY "billeteras_admin_all" ON public.billeteras
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

-- 2. BILLETERA RECARGAS
DROP POLICY IF EXISTS "Admins can view and manage all recharges" ON public.billetera_recargas;

CREATE POLICY "billetera_recargas_admin_all" ON public.billetera_recargas
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

-- 3. BILLETERA TRANSACCIONES
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.billetera_transacciones;

CREATE POLICY "billetera_transacciones_admin_all" ON public.billetera_transacciones
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

-- 4. Recargar caché de esquema
NOTIFY pgrst, 'reload schema';
