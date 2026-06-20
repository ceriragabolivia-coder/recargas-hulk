-- Migration: 029_multi_admin_support.sql
-- Description: Add support for isolated admin sales (vendedor_id in ventas)
-- Note: pedidos.atendido_por_id already exists (references auth.users), we don't touch it.
-- Only ventas.vendedor_id is new, linking to public.clientes for easy name resolution.

-- ============================================================
-- 1. Añadir vendedor_id a VENTAS (referencia a public.clientes)
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'vendedor_id'
    ) THEN
        ALTER TABLE public.ventas ADD COLUMN vendedor_id UUID REFERENCES public.clientes(id);
    END IF;
END $$;

-- ============================================================
-- 2. Actualizar función RPC registrar_venta_rpc para aceptar vendedor_id
-- ============================================================
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
    p_account_password TEXT DEFAULT NULL
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
        player_id, account_email, account_password
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
        p_player_id, p_account_email, p_account_password
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. RLS para aislar las VENTAS por vendedor (admin que la registró)
--    Cada admin solo puede ver sus propias ventas.
--    Se usa auth.uid() contra perfiles para hallar el cliente_uuid del admin.
-- ============================================================
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins see only their own sales" ON public.ventas;
CREATE POLICY "Admins see only their own sales" ON public.ventas
    FOR ALL USING (
        -- Admin solo ve ventas donde vendedor_id = su propio ID en tabla clientes
        -- O ventas antiguas donde vendedor_id es NULL (visibles para todos los admins)
        EXISTS (
            SELECT 1 FROM public.perfiles p
            JOIN public.clientes c ON c.auth_user_id = p.id
            WHERE p.id = auth.uid() AND p.rol = 'admin'
            AND (c.id = vendedor_id OR vendedor_id IS NULL)
        )
    );

-- ============================================================
-- 4. RLS de PEDIDOS — sin tocar atendido_por_id (ya es auth.users FK)
-- ============================================================
DROP POLICY IF EXISTS "auth_all" ON public.pedidos;

DROP POLICY IF EXISTS "Admins manage all orders" ON public.pedidos;
CREATE POLICY "Admins manage all orders" ON public.pedidos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Clients view their own orders" ON public.pedidos;
CREATE POLICY "Clients view their own orders" ON public.pedidos
    FOR SELECT USING (cliente_id = auth.uid());

-- Notificar recarga de caché
NOTIFY pgrst, 'reload schema';
