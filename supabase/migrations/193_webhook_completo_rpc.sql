-- Migración 193: RPC unificado para procesar webhooks de TiendaGiftVen
-- Este RPC ejecuta toda la lógica del webhook (actualizar item, verificar pedido, registrar venta, completar pedido) 
-- con SECURITY DEFINER para saltar el RLS (Row Level Security) y evitar que falle al ejecutarse de forma anónima desde Vercel.

CREATE OR REPLACE FUNCTION public.procesar_webhook_tiendagiftven_rpc(
    p_merchant_ref TEXT,
    p_pedido_id BIGINT,
    p_estado TEXT,
    p_mensaje TEXT
) RETURNS JSON AS $$
DECLARE
    v_item_id INT;
    v_pedido_interno_id INT;
    v_order_record RECORD;
    v_items_count INT;
    v_completed_count INT;
    v_vendedor_uuid UUID;
    v_superadmin_uuid UUID;
    v_item_record RECORD;
    v_result JSON;
BEGIN
    -- 1. Extraer ID del item desde merchant_ref (ej. HULK-ITEM-123-1698765432100)
    IF p_merchant_ref ~ 'ITEM-([0-9]+)' THEN
        v_item_id := (regexp_match(p_merchant_ref, 'ITEM-([0-9]+)'))[1]::INT;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Formato merchant_ref inválido');
    END IF;

    -- 2. Actualizar el item
    UPDATE public.pedido_items
    SET 
        estado_proveedor = p_estado,
        proveedor_pedido_id = p_pedido_id,
        mensaje_proveedor = p_mensaje,
        estado = CASE WHEN p_estado IN ('completado', 'aprobado') THEN 'completado'
                      WHEN p_estado IN ('error', 'fallido', 'cancelado', 'rechazado') THEN 'fallido'
                      ELSE estado END
    WHERE id = v_item_id
    RETURNING pedido_id INTO v_pedido_interno_id;

    IF v_pedido_interno_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item no encontrado o no actualizado');
    END IF;

    -- 3. Verificar si todos los items del pedido están completados
    SELECT COUNT(*), COUNT(*) FILTER (WHERE estado = 'completado')
    INTO v_items_count, v_completed_count
    FROM public.pedido_items
    WHERE pedido_id = v_pedido_interno_id;

    -- Si todos están completados
    IF v_items_count > 0 AND v_items_count = v_completed_count THEN
        
        -- Obtener detalles del pedido
        SELECT * INTO v_order_record FROM public.pedidos WHERE id = v_pedido_interno_id;

        IF v_order_record.estado != 'completado' THEN
            
            -- Obtener vendedor_uuid
            IF v_order_record.atendido_por_id IS NOT NULL THEN
                SELECT cliente_uuid INTO v_vendedor_uuid FROM public.perfiles WHERE id = v_order_record.atendido_por_id;
            END IF;

            IF v_vendedor_uuid IS NULL THEN
                SELECT id INTO v_superadmin_uuid FROM public.clientes WHERE usuario = 'recargashulk@gmail.com' LIMIT 1;
                v_vendedor_uuid := v_superadmin_uuid;
            END IF;

            -- Registrar ventas si no se han registrado
            IF NOT COALESCE(v_order_record.venta_registrada, false) THEN
                FOR v_item_record IN (SELECT * FROM public.pedido_items WHERE pedido_id = v_pedido_interno_id) LOOP
                    PERFORM public.registrar_venta_rpc(
                        v_item_record.producto_id,
                        v_item_record.cantidad,
                        'Pedido #' || v_order_record.numero_pedido || ' (API Webhook)',
                        v_order_record.cliente_id,
                        v_vendedor_uuid,
                        v_order_record.metodo_pago_id,
                        v_order_record.referencia_pago,
                        v_item_record.player_id,
                        v_item_record.account_email,
                        v_item_record.account_password,
                        v_pedido_interno_id,
                        v_order_record.owner_id
                    );
                END LOOP;
            END IF;

            -- Completar pedido
            UPDATE public.pedidos
            SET 
                estado = 'completado',
                venta_registrada = true,
                fecha_respuesta = NOW(),
                updated_at = NOW()
            WHERE id = v_pedido_interno_id;

            RETURN json_build_object('success', true, 'message', 'Pedido completado y ventas registradas');
        END IF;
    END IF;

    RETURN json_build_object('success', true, 'message', 'Item actualizado pero pedido aún no completado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
