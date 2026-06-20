-- Migration: fix_order_completion_and_tasa.sql
-- Description: Fixes the order completion block by ensuring tasa_dolar exists and the RPC is robust.

-- 1. Asegurar que tasa_dolar exista en la configuración para evitar fallos en cálculos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'tasa_dolar') THEN
        INSERT INTO public.configuracion (clave, valor, descripcion)
        VALUES ('tasa_dolar', 650, 'Tasa de cambio principal (Dólar)');
    ELSE
        UPDATE public.configuracion 
        SET valor = 650 
        WHERE clave = 'tasa_dolar' AND (valor IS NULL OR valor = 0);
    END IF;
END $$;

-- 2. Hacer que la función registrar_venta_rpc sea más robusta ante valores nulos
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
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    -- Obtener datos del producto y juego
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    
    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Obtener configuración de tasas con COALESCE para evitar nulos
    SELECT 
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar'), 1) AS tasa_dolar,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance'), 1) AS tasa_binance,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'real_dolar'), 1) AS real_dolar,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'descuentos'), 0) AS descuentos,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'porcentaje_paypal'), 0.08) AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa según tipo de juego (si es 0 o null, usar la otra disponible)
    IF v_juego.usa_tasa_binance THEN 
        v_tasa := COALESCE(v_config.tasa_binance, v_config.tasa_dolar, 1);
    ELSIF v_juego.usa_real_dolar THEN 
        v_tasa := COALESCE(v_config.real_dolar, v_config.tasa_dolar, 1);
    ELSE 
        v_tasa := COALESCE(v_config.tasa_dolar, v_config.tasa_binance, 1);
    END IF;

    -- Si la tasa sigue siendo inválida, forzar 1
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

    -- Asegurar que v_venta_usd no sea nulo
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
