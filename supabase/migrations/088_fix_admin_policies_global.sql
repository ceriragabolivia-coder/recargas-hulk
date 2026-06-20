
-- Migración 088: Unificación Global de Políticas Administrativas
-- Esta migración asegura que todas las tablas administrativas usen las funciones robustas is_admin() e is_superadmin().

-- 1. SOPORTE_MENSAJES (Chat de Soporte)
DROP POLICY IF EXISTS "soporte_mensajes_select_policy" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "soporte_mensajes_insert_policy" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "soporte_mensajes_update_policy" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "soporte_mensajes_delete_policy" ON public.soporte_mensajes;

CREATE POLICY "soporte_mensajes_admin_all" ON public.soporte_mensajes
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

CREATE POLICY "soporte_mensajes_user_select" ON public.soporte_mensajes
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.clientes c WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id)
    );

CREATE POLICY "soporte_mensajes_user_insert" ON public.soporte_mensajes
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.clientes c WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id)
    );

-- 2. VENTAS
DROP POLICY IF EXISTS "Admins see only their own sales" ON public.ventas;
CREATE POLICY "ventas_admin_management" ON public.ventas
    FOR ALL TO authenticated USING (
        public.is_superadmin() -- SuperAdmin ve TODO
        OR (public.is_admin() AND (vendedor_id IS NULL OR vendedor_id IN (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid())))
    );

-- 3. PEDIDOS
DROP POLICY IF EXISTS "Admins manage all orders" ON public.pedidos;
DROP POLICY IF EXISTS "Clients view their own orders" ON public.pedidos;

CREATE POLICY "pedidos_admin_all" ON public.pedidos
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

CREATE POLICY "pedidos_user_select" ON public.pedidos
    FOR SELECT TO authenticated USING (cliente_id = auth.uid());

-- 4. CLIENTES
DROP POLICY IF EXISTS "Permitir lectura a autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir inserción a autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir actualización a autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir eliminación a autenticados" ON public.clientes;

CREATE POLICY "clientes_admin_all" ON public.clientes
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

CREATE POLICY "clientes_self_select" ON public.clientes
    FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);

CREATE POLICY "clientes_self_update" ON public.clientes
    FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);

-- 5. CONFIGURACION (Proteger de usuarios normales)
DROP POLICY IF EXISTS "auth_all" ON public.configuracion;
CREATE POLICY "configuracion_admin_all" ON public.configuracion
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

CREATE POLICY "configuracion_user_select" ON public.configuracion
    FOR SELECT TO authenticated USING (true);

-- 6. ADMIN_SALDOS
DROP POLICY IF EXISTS "Admins pueden gestionar saldos" ON public.admin_saldos;
CREATE POLICY "admin_saldos_all" ON public.admin_saldos
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

DROP POLICY IF EXISTS "Admins pueden gestionar historial" ON public.admin_saldos_historial;
CREATE POLICY "admin_saldos_historial_all" ON public.admin_saldos_historial
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_superadmin());

-- 7. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
