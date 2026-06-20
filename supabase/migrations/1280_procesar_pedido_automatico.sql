-- Migration: 128_procesar_pedido_automatico.sql
-- Description: RPC para auto-procesar pedidos con entrega automática

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
    v_p_pedido_uuid UUID := NULL;
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

    -- Intento seguro de castear p_pedido_id a UUID si ventas.pedido_id lo requiere
    -- Por si acaso lo pasamos como NULL porque antes no fallaba con NULL.
    
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
                    NULL, -- p_pedido_id UUID
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
            atendido_por_id = (SELECT id FROM auth.users WHERE LOWER(email) = 'ceriraga@gmail.com' LIMIT 1),
            fecha_respuesta = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_id;
    END IF;

    RETURN json_build_object('success', TRUE, 'completado', v_todos_procesados AND v_alguna_venta_registrada);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
