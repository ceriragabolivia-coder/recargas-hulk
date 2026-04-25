-- Migration: 064_fix_registrar_venta_ambiguity.sql
-- Description: Fix ambiguity in registrar_venta_rpc by dropping all overloads and re-creating it correctly.

-- 1. Eliminar todas las posibles versiones de la función para evitar ambigüedad
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text, uuid);

-- 2. Re-crear la función correctamente con 11 parámetros (incluyendo p_pedido_id)
-- Se usa INT para p_pedido_id ya que la tabla pedidos usa SERIAL PRIMARY KEY
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
    p_pedido_id UUID DEFAULT NULL
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
    
    -- Obtener configuración de tasas
    SELECT 
        (SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM public.configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM public.configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM public.configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa según tipo de juego
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                               - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
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
        pedido_id
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
        p_pedido_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
