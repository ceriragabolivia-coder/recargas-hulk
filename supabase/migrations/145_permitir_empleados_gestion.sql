-- Migration 145: Permitir a operarios (empleado y trabajador) gestionar pedidos y items
-- Permite que los roles 'empleado' y 'trabajador' realicen select, insert, update y delete en pedidos y pedido_items.

-- ============================================================
-- 1. Actualizar RLS de pedidos
-- ============================================================
DROP POLICY IF EXISTS "Admins manage all orders" ON public.pedidos;
CREATE POLICY "Admins manage all orders" ON public.pedidos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
        )
    );

-- ============================================================
-- 2. Actualizar RLS de pedido_items (corrigiendo la tabla incorrecta profiles a perfiles)
-- ============================================================
DROP POLICY IF EXISTS "Admins pueden gestionar todos los items" ON public.pedido_items;
CREATE POLICY "Admins pueden gestionar todos los items" ON public.pedido_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE perfiles.id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE perfiles.id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
        )
    );

-- Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';
