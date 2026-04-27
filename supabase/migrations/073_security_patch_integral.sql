-- Migration: 073_security_patch_integral.sql
-- Description: Parche de seguridad integral para corregir RLS y proteger datos sensibles.

-- 1. FUNCIONES DE AYUDA (Helper Functions)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()) = 'ceriraga@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. LIMPIEZA DE POLÍTICAS ANTIGUAS (Reset total)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND (
            policyname LIKE 'auth_all%' OR 
            policyname LIKE 'Permitir %' OR 
            policyname LIKE '%isolation%' OR
            policyname LIKE 'Admins %'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. POLÍTICAS PARA TABLA: CLIENTES (Protección de identidad)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clientes: ver propio o admin" ON public.clientes;
CREATE POLICY "Clientes: ver propio o admin" ON public.clientes
    FOR SELECT USING (
        auth_user_id = auth.uid() 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Clientes: editar propio o admin" ON public.clientes;
CREATE POLICY "Clientes: editar propio o admin" ON public.clientes
    FOR UPDATE USING (
        auth_user_id = auth.uid() 
        OR public.is_admin()
    ) WITH CHECK (
        auth_user_id = auth.uid() 
        OR public.is_admin()
    );

-- 4. POLÍTICAS PARA TABLA: VENTAS (Protección financiera y claves)
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ventas: acceso restringido" ON public.ventas
    FOR ALL USING (
        public.is_admin() -- Admin ve todo (superadmin controlado en lógica interna si es necesario)
        OR (rol = 'negocio' AND owner_id = auth.uid()) -- Dueño del negocio ve lo suyo
        OR (cliente_id = auth.uid()) -- El cliente ve su propia compra (pero sin ver campos sensibles?)
    );

-- 5. POLÍTICAS PARA TABLA: CONFIGURACION (Protección de tasas)
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config: lectura autenticados" ON public.configuracion
    FOR SELECT TO authenticated USING (true); -- Clientes necesitan ver tasas

CREATE POLICY "Config: gestion admin" ON public.configuracion
    FOR ALL USING (
        public.is_admin() 
        OR owner_id = auth.uid()
    );

-- 6. POLÍTICAS PARA TABLA: PRODUCTO_CODIGOS (Protección de Gift Cards)
ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Codigos: solo admin o owner" ON public.producto_codigos
    FOR ALL USING (
        public.is_admin() 
        OR owner_id = auth.uid()
    );

-- 7. REFORZAR FUNCIÓN DE ASIGNACIÓN DE CÓDIGOS (RPC)
CREATE OR REPLACE FUNCTION public.asignar_codigo_pedido_item_rpc(p_pedido_item_id INT)
RETURNS TEXT AS $$
DECLARE
    v_producto_id INT;
    v_pedido_id INT;
    v_cliente_id UUID;
    v_codigo_id INT;
    v_codigo_text TEXT;
BEGIN
    -- 1. Verificar que el usuario que llama es dueño del pedido O es admin
    SELECT pi.producto_id, pi.pedido_id, p.cliente_id 
    INTO v_producto_id, v_pedido_id, v_cliente_id
    FROM public.pedido_items pi
    JOIN public.pedidos p ON pi.pedido_id = p.id
    WHERE pi.id = p_pedido_item_id;

    IF NOT (v_cliente_id = auth.uid() OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permiso para acceder a este código.';
    END IF;

    -- 2. Buscar un código disponible para ese producto
    SELECT id, codigo INTO v_codigo_id, v_codigo_text
    FROM public.producto_codigos
    WHERE producto_id = v_producto_id AND usado = FALSE
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- 3. Si encontramos código, asignarlo
    IF v_codigo_id IS NOT NULL THEN
        UPDATE public.producto_codigos 
        SET usado = TRUE, 
            pedido_id = v_pedido_id, 
            usado_at = NOW() 
        WHERE id = v_codigo_id;

        UPDATE public.pedido_items 
        SET codigo_entregado = v_codigo_text 
        WHERE id = p_pedido_item_id;

        RETURN v_codigo_text;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TABLA CUENTAS FORTNITE (Aislamiento total)
ALTER TABLE public.cuentas_fortnite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fortnite: solo admin" ON public.cuentas_fortnite
    FOR ALL USING (public.is_admin());

-- 9. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
