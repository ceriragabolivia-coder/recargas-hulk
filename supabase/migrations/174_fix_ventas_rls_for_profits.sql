-- Migración 174: Permitir que todos los Admins puedan VER (SELECT) todas las ventas para calcular ganancias correctamente.
-- Mantenemos la restricción de que solo el dueño o SuperAdmin puede MODIFICAR o ELIMINAR sus ventas.

DROP POLICY IF EXISTS "ventas_admin_management" ON public.ventas;

-- Política para que Admins puedan VER (SELECT) todas las ventas
CREATE POLICY "ventas_admin_select_all" ON public.ventas
    FOR SELECT TO authenticated USING (
        public.is_superadmin() OR public.is_admin()
    );

-- Política para INSERT, UPDATE, DELETE (Solo dueños o SuperAdmin)
CREATE POLICY "ventas_admin_modify" ON public.ventas
    FOR INSERT TO authenticated WITH CHECK (
        public.is_superadmin() OR (public.is_admin() AND (vendedor_id IS NULL OR vendedor_id IN (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid())))
    );

CREATE POLICY "ventas_admin_update" ON public.ventas
    FOR UPDATE TO authenticated USING (
        public.is_superadmin() OR (public.is_admin() AND (vendedor_id IS NULL OR vendedor_id IN (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid())))
    ) WITH CHECK (
        public.is_superadmin() OR (public.is_admin() AND (vendedor_id IS NULL OR vendedor_id IN (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid())))
    );

CREATE POLICY "ventas_admin_delete" ON public.ventas
    FOR DELETE TO authenticated USING (
        public.is_superadmin() OR (public.is_admin() AND (vendedor_id IS NULL OR vendedor_id IN (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid())))
    );

NOTIFY pgrst, 'reload schema';
