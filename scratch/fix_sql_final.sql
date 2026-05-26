-- 1. Restaurar las funciones de pago con billetera a su estado original correcto (solo descuento)
-- El ingreso al superadmin se maneja automáticamente por el trigger `trig_act_saldos_admin` 
-- cuando el pedido pasa a estado 'completado'.

CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Descontar del usuario
    UPDATE public.billeteras
    SET saldo = saldo - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- Registro del usuario
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id, 'usd');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Descontar del usuario
    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- Registro del usuario
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id, 'bs');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corregir procesar_pedido_automatico_rpc para evitar el crasheo de tipo (INT vs UUID)
-- Esto permitirá que se complete la orden, entregue el código y active el trigger de saldo.

CREATE OR REPLACE FUNCTION public.procesar_pedido_automatico_rpc(p_pedido_id UUID)
RETURNS JSON AS $$
DECLARE
    v_pedido RECORD;
    v_item RECORD;
    v_producto RECORD;
    v_codigo_asignado TEXT;
    v_codigo_id INT;
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

    -- CORRECCIÓN: Obtener el UUID (auth_user_id) de auth.users, NO el ID (INT) de clientes.
    SELECT u.id INTO v_superadmin_id 
    FROM auth.users u 
    WHERE LOWER(u.email) = 'ceriraga@gmail.com' LIMIT 1;
    
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
                    p_pedido_id,
                    v_pedido.owner_id
                );

                -- ASIGNACIÓN DIRECTA DE CÓDIGO
                v_codigo_id := NULL;
                v_codigo_asignado := NULL;
                
                SELECT id, codigo INTO v_codigo_id, v_codigo_asignado
                FROM public.producto_codigos
                WHERE producto_id = v_producto.id AND usado = FALSE
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED;

                IF v_codigo_id IS NOT NULL THEN
                    UPDATE public.producto_codigos 
                    SET usado = TRUE, 
                        pedido_id = p_pedido_id, 
                        usado_at = NOW() 
                    WHERE id = v_codigo_id;

                    UPDATE public.pedido_items 
                    SET codigo_entregado = v_codigo_asignado,
                        estado = 'completado'
                    WHERE id = v_item.id;
                    
                    v_alguna_venta_registrada := TRUE;
                ELSE
                    v_todos_procesados := FALSE;
                END IF;

            ELSE
                v_todos_procesados := FALSE;
            END IF;
        ELSE
            v_todos_procesados := FALSE;
        END IF;
    END LOOP;

    -- Al pasar a 'completado', se disparará automáticamente el trigger `trig_act_saldos_admin` 
    -- que sumará el saldo de la venta al monedero operativo del superadmin.
    IF v_todos_procesados AND v_alguna_venta_registrada THEN
        UPDATE public.pedidos 
        SET estado = 'completado', 
            venta_registrada = TRUE, 
            atendido_por_id = v_superadmin_id,
            fecha_respuesta = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_id;
    END IF;

    RETURN json_build_object('success', TRUE, 'completado', v_todos_procesados AND v_alguna_venta_registrada);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
