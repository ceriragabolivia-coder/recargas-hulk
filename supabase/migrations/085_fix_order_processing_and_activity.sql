
-- Migration 085: Corrección Definitiva (Modo UUID)
-- Este parche corrige la discrepancia de tipos y asegura el registro de actividad.

-- 1. Asegurar tabla de actividad
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    tipo_evento TEXT,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Función de Actividad
DROP FUNCTION IF EXISTS public.registrar_actividad_usuario(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.registrar_actividad_usuario(p_tipo TEXT, p_session_id TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_activity (user_id, tipo_evento, session_id, created_at)
    VALUES (auth.uid(), p_tipo, p_session_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Restaurar admin_saldos_historial a UUID (Para que coincida con pedidos.id que es UUID)
DO $$ 
BEGIN
    -- Eliminar FK si existe para poder cambiar el tipo
    ALTER TABLE public.admin_saldos_historial DROP CONSTRAINT IF EXISTS admin_saldos_historial_pedido_id_fkey;
    
    -- Cambiar a UUID (Usando NULL para limpiar si hubo basura de la ejecución fallida anterior)
    ALTER TABLE public.admin_saldos_historial ALTER COLUMN pedido_id TYPE UUID USING NULL; 
    
    -- Restaurar FK
    ALTER TABLE public.admin_saldos_historial ADD CONSTRAINT admin_saldos_historial_pedido_id_fkey 
    FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;
END $$;

-- 4. Limpieza total y recreación de registrar_venta_rpc
-- Eliminamos todas las posibles versiones antiguas para evitar conflictos de caché
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(INT, INT, TEXT);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(INT, INT, TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(INT, INT, TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(INT, INT, TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID);

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
    p_pedido_id UUID DEFAULT NULL, -- Mantenemos UUID para consistencia con la tabla pedidos
    p_owner_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    -- Obtener datos del producto
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    
    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Obtener configuración de tasas
    SELECT 
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar'), 1) AS tasa_dolar,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance'), 1) AS tasa_binance,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'real_dolar'), 1) AS real_dolar,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'descuentos'), 0) AS descuentos,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'porcentaje_paypal'), 0.08) AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa
    IF v_juego.usa_tasa_binance THEN 
        v_tasa := COALESCE(v_config.tasa_binance, v_config.tasa_dolar, 1);
    ELSIF v_juego.usa_real_dolar THEN 
        v_tasa := COALESCE(v_config.real_dolar, v_config.tasa_dolar, 1);
    ELSE 
        v_tasa := COALESCE(v_config.tasa_dolar, v_config.tasa_binance, 1);
    END IF;

    IF v_tasa <= 0 THEN v_tasa := 1; END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL AND v_producto.precio_venta_fijo > 0 THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0));
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    -- Insertar la venta
    INSERT INTO public.ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id,
        metodo_pago_id, referencia_pago,
        player_id, account_email, account_password,
        pedido_id, owner_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id,
        p_vendedor_id,
        p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password,
        p_pedido_id, p_owner_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificar a postgREST
NOTIFY pgrst, 'reload schema';
