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

    SELECT c.id INTO v_superadmin_id 
    FROM public.clientes c
    JOIN auth.users u ON u.id = c.auth_user_id
    WHERE LOWER(u.email) = 'ceriraga@gmail.com' LIMIT 1;
    
    IF v_superadmin_id IS NULL THEN
        SELECT c.id INTO v_superadmin_id 
        FROM public.clientes c
        WHERE LOWER(c.usuario) = 'ceriraga@gmail.com' LIMIT 1;
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
                    p_pedido_id,
                    v_pedido.owner_id
                );

                -- ASIGNACIÓN DIRECTA DE CÓDIGO (EVITANDO ERROR DE AUTH.UID NULO)
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
                    SET codigo_entregado = v_codigo_asignado 
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

    IF v_todos_procesados AND v_alguna_venta_registrada THEN
        UPDATE public.pedidos 
        SET estado = 'completado', 
            venta_registrada = TRUE, 
            atendido_por_id = (SELECT id FROM auth.users WHERE LOWER(email) = 'ceriraga@gmail.com' LIMIT 1),
            fecha_respuesta = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_id;
    END IF;

    RETURN json_build_object('success', TRUE, 'completado', v_todos_procesados AND v_alguna_venta_registrada);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
