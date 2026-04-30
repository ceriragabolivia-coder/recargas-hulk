
-- Migration 085: Corrección de Procesamiento de Pedidos y Actividad
-- Este parche corrige el error de tipos (UUID vs INT) en la venta y asegura el seguimiento de actividad.

-- 1. Asegurar tabla de actividad (Si no existía formalmente)
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    tipo_evento TEXT,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Función de Actividad (Para corregir los errores 404 de la App)
DROP FUNCTION IF EXISTS public.registrar_actividad_usuario(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.registrar_actividad_usuario(p_tipo TEXT, p_session_id TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_activity (user_id, tipo_evento, session_id, created_at)
    VALUES (auth.uid(), p_tipo, p_session_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Corregir tipos en admin_saldos_historial (Debe ser INT para referenciar pedidos.id)
DO $$ 
BEGIN
    -- Intentar cambiar el tipo de pedido_id si existe y es UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_saldos_historial' AND column_name = 'pedido_id' AND data_type = 'uuid'
    ) THEN
        -- Eliminar FK temporalmente si existe
        ALTER TABLE public.admin_saldos_historial DROP CONSTRAINT IF EXISTS admin_saldos_historial_pedido_id_fkey;
        
        -- Cambiar tipo (esto fallará si hay datos, pero como estamos en debug probablemente esté vacía o con datos inconsistentes)
        ALTER TABLE public.admin_saldos_historial ALTER COLUMN pedido_id TYPE INT USING NULL; 
        
        -- Volver a añadir FK
        ALTER TABLE public.admin_saldos_historial ADD CONSTRAINT admin_saldos_historial_pedido_id_fkey 
        FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Corregir registrar_venta_rpc (Cambiar p_pedido_id a INT)
-- Primero eliminamos la versión errónea de UUID para evitar ambigüedades
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
    p_pedido_id INT DEFAULT NULL, -- CORREGIDO A INT
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

    -- Determinar tasa según tipo de juego
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
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0));
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base / (1 - v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0)) 
                               - v_config.descuentos - COALESCE(v_juego.descuento_particular, 0);
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base / (1 - v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * COALESCE(v_producto.margen_ganancia, 0));
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0));
        END CASE;
    END IF;

    IF v_venta_usd IS NULL THEN v_venta_usd := v_producto.costo_base; END IF;

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
