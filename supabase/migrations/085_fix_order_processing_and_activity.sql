
-- Migration 085: Corrección Integral de Ventas, Actividad y Saldos Admin
-- Este parche consolida todas las soluciones aplicadas para permitir el procesamiento de pedidos.

-- 1. LIMPIEZA DE FUNCIONES DUPLICADAS (Evita el error 'Could not choose best candidate')
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure as sig FROM pg_proc 
        WHERE proname = 'registrar_venta_rpc' AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig;
    END LOOP;
END $$;

-- 2. TABLA Y FUNCIÓN DE ACTIVIDAD (Elimina errores 404)
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    tipo_evento TEXT,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.registrar_actividad_usuario(p_tipo TEXT, p_session_id TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_activity (user_id, tipo_evento, session_id, created_at)
    VALUES (auth.uid(), p_tipo, p_session_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN DE REGISTRO DE VENTAS (Versión Robusta con Casting y UUID)
CREATE OR REPLACE FUNCTION public.registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL,
    p_pedido_id UUID DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_tasa_dolar NUMERIC;
    v_tasa_binance NUMERIC;
    v_real_dolar NUMERIC;
    v_tasa_final NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Producto no encontrado'); END IF;
    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Configuración con casting explícito
    SELECT valor::NUMERIC INTO v_tasa_dolar FROM public.configuracion WHERE clave = 'tasa_dolar';
    SELECT valor::NUMERIC INTO v_tasa_binance FROM public.configuracion WHERE clave = 'tasa_binance';
    SELECT valor::NUMERIC INTO v_real_dolar FROM public.configuracion WHERE clave = 'real_dolar';

    v_tasa_dolar := COALESCE(v_tasa_dolar, 1);
    v_tasa_binance := COALESCE(v_tasa_binance, v_tasa_dolar, 1);
    v_real_dolar := COALESCE(v_real_dolar, v_tasa_dolar, 1);

    IF v_juego.usa_tasa_binance THEN v_tasa_final := v_tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa_final := v_real_dolar;
    ELSE v_tasa_final := v_tasa_dolar;
    END IF;

    IF v_tasa_final <= 0 THEN v_tasa_final := 1; END IF;

    IF v_producto.precio_venta_fijo > 0 THEN 
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE 
        v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0));
    END IF;

    v_venta_bs := v_venta_usd * v_tasa_final;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO public.ventas (
        producto_id, juego_id, cantidad, tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento, precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id, metodo_pago_id, referencia_pago, player_id, account_email, account_password, 
        pedido_id, owner_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad, v_tasa_final, v_real_dolar, v_tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia, ROUND(v_venta_usd * p_cantidad, 2), ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2), p_notas, p_cliente_id, p_vendedor_id, p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password, p_pedido_id, p_owner_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER DE SALDOS ADMIN (Seguridad Reforzada)
CREATE OR REPLACE FUNCTION public.trig_act_saldos_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_monto NUMERIC;
BEGIN
    v_monto := COALESCE(NEW.total_usd, 0);
    IF NEW.estado = 'completado' AND (TG_OP = 'INSERT' OR OLD.estado != 'completado') THEN
        IF NEW.atendido_por_id IS NOT NULL THEN
            INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, updated_at)
            VALUES (NEW.atendido_por_id, v_monto, now())
            ON CONFLICT (auth_user_id) 
            DO UPDATE SET saldo_usd = public.admin_saldos.saldo_usd + EXCLUDED.saldo_usd, updated_at = now();

            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (NEW.atendido_por_id, NEW.id, 'credito_venta', 'usd', v_monto, 'Crédito automático Pedido #' || NEW.numero_pedido);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_act_saldos_admin_pedidos ON public.pedidos;
CREATE TRIGGER trig_act_saldos_admin_pedidos
AFTER UPDATE OF estado ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trig_act_saldos_admin();

-- 5. POLÍTICAS DE RLS PARA ADMIN_SALDOS
ALTER TABLE public.admin_saldos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins pueden gestionar saldos" ON public.admin_saldos;
CREATE POLICY "Admins pueden gestionar saldos" ON public.admin_saldos
    FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

ALTER TABLE public.admin_saldos_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins pueden gestionar historial" ON public.admin_saldos_historial;
CREATE POLICY "Admins pueden gestionar historial" ON public.admin_saldos_historial
    FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

NOTIFY pgrst, 'reload schema';
