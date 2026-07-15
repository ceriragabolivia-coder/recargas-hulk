-- Migración 179: Corregir error owner_id inexistente en pedidos

-- 1. Parchar el bot automático
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
    v_errores JSONB := '[]'::JSONB;
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
        SELECT c.id INTO v_superadmin_id FROM public.clientes c WHERE LOWER(c.usuario) = 'recargashulk@gmail.com' LIMIT 1;
    END IF;

    FOR v_item IN SELECT * FROM public.pedido_items WHERE pedido_id = p_pedido_id LOOP
        SELECT * INTO v_producto FROM public.productos WHERE id = v_item.producto_id;
        
        IF v_producto.entrega_automatica THEN
            IF EXISTS (SELECT 1 FROM public.producto_codigos WHERE producto_id = v_producto.id AND usado = FALSE) THEN
                
                v_venta := public.registrar_venta_rpc(
                    v_item.producto_id, v_item.cantidad,
                    'Auto-proceso Pedido #' || COALESCE(v_pedido.numero_pedido::TEXT, p_pedido_id::TEXT),
                    v_pedido.cliente_id, v_superadmin_id, v_pedido.metodo_pago_id, v_pedido.referencia_pago,
                    v_item.player_id, v_item.account_email, v_item.account_password, NULL, NULL -- <- CORREGIDO: NULL en lugar de v_pedido.owner_id
                );

                IF v_venta->>'error' IS NOT NULL THEN
                    v_todos_procesados := FALSE;
                    v_errores := v_errores || jsonb_build_object('item', v_item.id, 'error', v_venta->>'error');
                ELSE
                    v_codigo_asignado := public.asignar_codigo_pedido_item_rpc(v_item.id);
                    IF v_codigo_asignado IS NULL THEN
                        v_todos_procesados := FALSE;
                    ELSE
                        v_alguna_venta_registrada := TRUE;
                    END IF;
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
        SET estado = 'completado', venta_registrada = TRUE, 
            atendido_por_id = (SELECT id FROM auth.users WHERE LOWER(email) = 'recargashulk@gmail.com' LIMIT 1),
            fecha_respuesta = NOW(), updated_at = NOW()
        WHERE id = p_pedido_id;
    END IF;

    IF NOT v_todos_procesados THEN
        RETURN json_build_object('success', FALSE, 'completado', FALSE, 'errores_ventas', v_errores);
    END IF;

    RETURN json_build_object('success', TRUE, 'completado', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Parchar Script de Rescate
CREATE OR REPLACE FUNCTION public.backfill_ventas_perdidas()
RETURNS JSON AS $$
DECLARE
    v_pedido RECORD;
    v_item RECORD;
    v_superadmin_id UUID;
    v_ventas_insertadas INT := 0;
    v_errores JSONB := '[]'::JSONB;
    v_resultado JSON;
BEGIN
    SELECT c.id INTO v_superadmin_id FROM public.clientes c JOIN auth.users u ON u.id = c.auth_user_id WHERE LOWER(u.email) = 'recargashulk@gmail.com' LIMIT 1;
    IF v_superadmin_id IS NULL THEN
        SELECT c.id INTO v_superadmin_id FROM public.clientes c WHERE LOWER(c.usuario) = 'recargashulk@gmail.com' LIMIT 1;
    END IF;

    FOR v_pedido IN 
        SELECT p.* FROM public.pedidos p WHERE p.estado = 'completado'
          AND NOT EXISTS (
              SELECT 1 FROM public.ventas v WHERE v.notas = 'Auto-proceso Pedido #' || COALESCE(p.numero_pedido::TEXT, p.id::TEXT) OR v.pedido_id::text = p.id::text
          )
    LOOP
        FOR v_item IN SELECT * FROM public.pedido_items WHERE pedido_id = v_pedido.id LOOP
            v_resultado := public.registrar_venta_rpc(
                v_item.producto_id, v_item.cantidad, 'Auto-proceso Pedido #' || COALESCE(v_pedido.numero_pedido::TEXT, v_pedido.id::TEXT),
                v_pedido.cliente_id, v_superadmin_id, v_pedido.metodo_pago_id, v_pedido.referencia_pago,
                v_item.player_id, v_item.account_email, v_item.account_password, NULL, NULL -- <- CORREGIDO: NULL en lugar de v_pedido.owner_id
            );
            
            IF v_resultado->>'error' IS NOT NULL THEN
                v_errores := v_errores || jsonb_build_object('pedido', COALESCE(v_pedido.numero_pedido::TEXT, v_pedido.id::TEXT), 'error', v_resultado->>'error');
            ELSE
                v_ventas_insertadas := v_ventas_insertadas + 1;
            END IF;
        END LOOP;
    END LOOP;
    RETURN json_build_object('ventas_recuperadas', v_ventas_insertadas, 'errores', v_errores);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
