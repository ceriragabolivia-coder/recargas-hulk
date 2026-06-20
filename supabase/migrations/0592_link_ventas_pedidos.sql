-- Migration: 059_link_ventas_pedidos.sql
-- Description: Link ventas table with pedidos for detailed transaction history

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'pedido_id'
    ) THEN
        ALTER TABLE public.ventas ADD COLUMN pedido_id INT REFERENCES public.pedidos(id);
    END IF;
END $$;

-- Actualizar función RPC registrar_venta_rpc para aceptar p_pedido_id
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
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
    p_pedido_id INT DEFAULT NULL
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
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
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

    INSERT INTO ventas (
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

NOTIFY pgrst, 'reload schema';
