-- ============================================================
-- FIX: Métodos de Pago no visibles (RLS rota)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/vsmpxvzmferpqpfaulgb/sql
-- ============================================================

-- 1. Eliminar políticas antiguas/rotas
DROP POLICY IF EXISTS "Métodos de pago visibles para todos" ON public.metodos_pago;
DROP POLICY IF EXISTS "Admin gestiona métodos de pago" ON public.metodos_pago;
DROP POLICY IF EXISTS "metodos_pago_select_all" ON public.metodos_pago;
DROP POLICY IF EXISTS "metodos_pago_admin_all" ON public.metodos_pago;

-- 2. Política correcta: todos pueden ver (incluso anon)
CREATE POLICY "metodos_pago_select_all"
    ON public.metodos_pago
    FOR SELECT
    USING (true);

-- 3. Política correcta: admins pueden gestionar
CREATE POLICY "metodos_pago_admin_all"
    ON public.metodos_pago
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid()
            AND (rol IN ('admin', 'administrador', 'negocio', 'empleado'))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid()
            AND (rol IN ('admin', 'administrador', 'negocio', 'empleado'))
        )
    );

-- 4. Recargar schema
NOTIFY pgrst, 'reload schema';

-- Verificar que los métodos existen:
SELECT id, nombre, activo FROM public.metodos_pago ORDER BY created_at;
