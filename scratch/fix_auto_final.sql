-- VERSIÓN FINAL SIMPLIFICADA: Solo entrega el código y cambia el estado.
-- No intenta llamar a registrar_venta_rpc para evitar errores de tipos y permisos.
-- El trigger trig_act_saldos_admin se encarga de sumar al saldo operativo del superadmin.

CREATE OR REPLACE FUNCTION public.procesar_pedido_automatico_rpc(p_pedido_id UUID)
RETURNS JSON AS $$
DECLARE
    v_pedido RECORD;
    v_item RECORD;
    v_producto RECORD;
    v_codigo_asignado TEXT;
    v_codigo_id INT;
    v_alguna_entrega BOOLEAN := FALSE;
    v_todos_automaticos BOOLEAN := TRUE;
    v_superadmin_id UUID;
BEGIN
    -- 1. Obtener pedido (bypassea RLS por SECURITY DEFINER)
    SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
    IF NOT FOUND THEN 
        RETURN json_build_object('success', FALSE, 'error', 'Pedido no encontrado'); 
    END IF;

    -- 2. Validar estado
    IF COALESCE(v_pedido.pago_verificado, FALSE) = FALSE THEN
        RETURN json_build_object('success', FALSE, 'error', 'Pago no verificado');
    END IF;
    
    IF v_pedido.estado != 'pendiente' THEN
        RETURN json_build_object('success', FALSE, 'error', 'Pedido ya procesado: ' || v_pedido.estado);
    END IF;

    -- 3. Obtener UUID del superadmin
    SELECT id INTO v_superadmin_id FROM auth.users WHERE LOWER(email) = 'ceriraga@gmail.com' LIMIT 1;

    -- 4. Procesar cada item
    FOR v_item IN SELECT * FROM public.pedido_items WHERE pedido_id = p_pedido_id LOOP
        SELECT * INTO v_producto FROM public.productos WHERE id = v_item.producto_id;
        
        IF v_producto.entrega_automatica THEN
            -- Buscar código disponible con lock atómico
            SELECT id, codigo INTO v_codigo_id, v_codigo_asignado
            FROM public.producto_codigos
            WHERE producto_id = v_producto.id AND usado = FALSE
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF v_codigo_id IS NOT NULL THEN
                -- Marcar código como usado
                UPDATE public.producto_codigos 
                SET usado = TRUE, 
                    pedido_id = p_pedido_id, 
                    usado_at = NOW() 
                WHERE id = v_codigo_id;

                -- Entregar código al item y marcarlo completado
                UPDATE public.pedido_items 
                SET codigo_entregado = v_codigo_asignado,
                    estado = 'completado'
                WHERE id = v_item.id;
                
                v_alguna_entrega := TRUE;
            ELSE
                v_todos_automaticos := FALSE;
            END IF;
        ELSE
            v_todos_automaticos := FALSE;
        END IF;
    END LOOP;

    -- 5. Si se entregó al menos un código, marcar pedido como completado
    IF v_alguna_entrega THEN
        UPDATE public.pedidos 
        SET estado = 'completado', 
            venta_registrada = TRUE, 
            atendido_por_id = v_superadmin_id,
            fecha_respuesta = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_id;
        -- NOTA: El trigger trig_act_saldos_admin se activará automáticamente
        -- al cambiar estado a 'completado' y sumará al saldo operativo.
        
        RETURN json_build_object(
            'success', TRUE, 
            'completado', v_todos_automaticos,
            'mensaje', 'Código entregado automáticamente'
        );
    END IF;

    RETURN json_build_object('success', FALSE, 'error', 'Sin stock disponible para entrega automática');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
