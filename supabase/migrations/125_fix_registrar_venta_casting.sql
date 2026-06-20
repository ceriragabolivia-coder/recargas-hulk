-- Migration: 125_fix_registrar_venta_casting.sql
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
    v_superadmin_id UUID;
BEGIN
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Producto no encontrado'); END IF;
    
    -- Si es entrega automática, forzamos al SuperAdmin como vendedor
    IF v_producto.entrega_automatica THEN
        SELECT id INTO v_superadmin_id FROM auth.users WHERE lower(email) = 'recargashulk@gmail.com' LIMIT 1;
        IF v_superadmin_id IS NOT NULL THEN
            p_vendedor_id := v_superadmin_id;
        END IF;
    END IF;

    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Configuración con casting explícito (Causa del error solucionada)
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

NOTIFY pgrst, 'reload schema';
