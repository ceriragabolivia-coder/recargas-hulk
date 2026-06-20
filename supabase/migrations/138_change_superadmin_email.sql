-- Migration: 138_change_superadmin_email.sql
-- Description: Redefinir funciones y políticas para usar 'recargashulk@gmail.com' como SuperAdmin

-- 1. Redefinir is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'recargashulk@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefinir políticas de RLS de Perfiles
DROP POLICY IF EXISTS "Perfiles: SuperAdmin full access" ON public.perfiles;
CREATE POLICY "Perfiles: SuperAdmin full access" 
ON public.perfiles FOR ALL 
TO authenticated 
USING (
    (auth.jwt() ->> 'email') = 'recargashulk@gmail.com'
    OR public.is_superadmin()
)
WITH CHECK (
    (auth.jwt() ->> 'email') = 'recargashulk@gmail.com'
    OR public.is_superadmin()
);

-- 3. Redefinir admin_reset_password_rpc
CREATE OR REPLACE FUNCTION admin_reset_password_rpc(p_user_id UUID, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requester_id UUID;
  v_requester_email TEXT;
  v_target_email TEXT;
  v_is_admin BOOLEAN;
BEGIN
  v_requester_id := auth.uid();
  v_requester_email := (SELECT LOWER(email) FROM auth.users WHERE id = v_requester_id);
  v_target_email := (SELECT LOWER(email) FROM auth.users WHERE id = p_user_id);
  
  -- Verificar que el que llama sea administrador
  SELECT (rol = 'admin') INTO v_is_admin FROM public.perfiles WHERE id = v_requester_id;

  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de administrador');
  END IF;

  -- SEGURIDAD CRÍTICA: Nadie puede cambiar la clave del SuperAdmin excepto él mismo
  IF v_target_email = 'recargashulk@gmail.com' AND v_requester_email != 'recargashulk@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para modificar la cuenta principal del sistema.');
  END IF;

  -- Actualizar la contraseña
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Redefinir registrar_venta_rpc
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
        SELECT c.id INTO v_superadmin_id 
        FROM public.clientes c
        JOIN auth.users u ON u.id = c.auth_user_id
        WHERE LOWER(u.email) = 'recargashulk@gmail.com' LIMIT 1;
        
        IF v_superadmin_id IS NULL THEN
            SELECT c.id INTO v_superadmin_id 
            FROM public.clientes c
            WHERE LOWER(c.usuario) = 'recargashulk@gmail.com' LIMIT 1;
        END IF;

        IF v_superadmin_id IS NOT NULL THEN
            p_vendedor_id := v_superadmin_id;
        END IF;
    END IF;

    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
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

-- 5. Redefinir override_atendido_por_auto_delivery
CREATE OR REPLACE FUNCTION public.override_atendido_por_auto_delivery()
RETURNS TRIGGER AS $$
DECLARE
    v_has_auto BOOLEAN;
    v_superadmin_id UUID;
BEGIN
    IF NEW.estado = 'completado' AND OLD.estado != 'completado' THEN
        SELECT EXISTS (
            SELECT 1 
            FROM public.pedido_items pi
            JOIN public.productos p ON p.id = pi.producto_id
            WHERE pi.pedido_id = NEW.id AND p.entrega_automatica = TRUE
        ) INTO v_has_auto;

        IF v_has_auto THEN
            SELECT id INTO v_superadmin_id FROM auth.users WHERE lower(email) = 'recargashulk@gmail.com' LIMIT 1;
            IF v_superadmin_id IS NOT NULL THEN
                NEW.atendido_por_id := v_superadmin_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Redefinir procesar_pedido_automatico_rpc
CREATE OR REPLACE FUNCTION public.procesar_pedido_automatico_rpc(p_pedido_id INT)
RETURNS JSON AS $$
DECLARE
    v_pedido RECORD;
    v_item RECORD;
    v_producto RECORD;
    v_codigo_asignado TEXT;
    v_venta JSON;
    v_todos_procesados BOOLEAN := TRUE;
    v_alguna_venta_registrada BOOLEAN := FALSE;
    v_superadmin_id UUID;
BEGIN
    SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Pedido no encontrado'); END IF;

    IF COALESCE(v_pedido.pago_verificado, FALSE) = FALSE OR v_pedido.estado != 'pendiente' THEN
        RETURN json_build_object('success', FALSE, 'message', 'Pedido no válido para proceso automático');
    END IF;

    SELECT c.id INTO v_superadmin_id 
    FROM public.clientes c
    JOIN auth.users u ON u.id = c.auth_user_id
    WHERE LOWER(u.email) = 'recargashulk@gmail.com' LIMIT 1;
    
    IF v_superadmin_id IS NULL THEN
        SELECT c.id INTO v_superadmin_id 
        FROM public.clientes c
        WHERE LOWER(c.usuario) = 'recargashulk@gmail.com' LIMIT 1;
    END IF;

    FOR v_item IN SELECT * FROM public.pedido_items WHERE pedido_id = p_pedido_id LOOP
        SELECT * INTO v_producto FROM public.productos WHERE id = v_item.producto_id;
        
        IF v_producto.entrega_automatica THEN
            IF EXISTS (SELECT 1 FROM public.producto_codigos WHERE producto_id = v_producto.id AND usado = FALSE) THEN
                
                v_venta := public.registrar_venta_rpc(
                    v_item.producto_id,
                    v_item.cantidad,
                    'Auto-proceso Pedido #' || COALESCE(v_pedido.numero_pedido::TEXT, p_pedido_id::TEXT),
                    v_pedido.cliente_id,
                    v_superadmin_id,
                    v_pedido.metodo_pago_id,
                    v_pedido.referencia_pago,
                    v_item.player_id,
                    v_item.account_email,
                    v_item.account_password,
                    NULL,
                    v_pedido.owner_id
                );

                v_codigo_asignado := public.asignar_codigo_pedido_item_rpc(v_item.id);
                IF v_codigo_asignado IS NULL THEN
                    v_todos_procesados := FALSE;
                ELSE
                    v_alguna_venta_registrada := TRUE;
                END IF;
            ELSE
                v_todos_procesados := FALSE;
            END IF;
        ELSE
            v_todos_procesados := FALSE;
        END IF;
    END LOOP;

    IF v_todos_procesados AND v_alguna_venta_registrada THEN
        UPDATE public.pedidos 
        SET estado = 'completado', 
            venta_registrada = TRUE, 
            atendido_por_id = (SELECT id FROM auth.users WHERE LOWER(email) = 'recargashulk@gmail.com' LIMIT 1),
            fecha_respuesta = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_id;
    END IF;

    RETURN json_build_object('success', TRUE, 'completado', v_todos_procesados AND v_alguna_venta_registrada);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Recargar esquema
NOTIFY pgrst, 'reload schema';
