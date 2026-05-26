-- 1. Agregar columna de orden a la tabla producto_codigos
ALTER TABLE public.producto_codigos ADD COLUMN IF NOT EXISTS orden INT;

-- 2. Asignar orden inicial basado en created_at para los disponibles
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY producto_id ORDER BY created_at ASC) AS rn
  FROM public.producto_codigos
  WHERE usado = FALSE
)
UPDATE public.producto_codigos pc
SET orden = r.rn
FROM ranked r
WHERE pc.id = r.id;

-- 3. Actualizar procesar_pedido_automatico_rpc para respetar el orden
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
    SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
    IF NOT FOUND THEN 
        RETURN json_build_object('success', FALSE, 'error', 'Pedido no encontrado'); 
    END IF;

    IF COALESCE(v_pedido.pago_verificado, FALSE) = FALSE THEN
        RETURN json_build_object('success', FALSE, 'error', 'Pago no verificado');
    END IF;
    
    IF v_pedido.estado != 'pendiente' THEN
        RETURN json_build_object('success', FALSE, 'error', 'Pedido ya procesado: ' || v_pedido.estado);
    END IF;

    SELECT id INTO v_superadmin_id FROM auth.users WHERE LOWER(email) = 'ceriraga@gmail.com' LIMIT 1;

    FOR v_item IN SELECT * FROM public.pedido_items WHERE pedido_id = p_pedido_id LOOP
        SELECT * INTO v_producto FROM public.productos WHERE id = v_item.producto_id;
        
        IF v_producto.entrega_automatica THEN
            -- Seleccionar por orden definido por admin (orden ASC), luego por created_at como fallback
            SELECT id, codigo INTO v_codigo_id, v_codigo_asignado
            FROM public.producto_codigos
            WHERE producto_id = v_producto.id AND usado = FALSE
            ORDER BY 
                CASE WHEN orden IS NOT NULL THEN orden ELSE 999999 END ASC,
                created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF v_codigo_id IS NOT NULL THEN
                UPDATE public.producto_codigos 
                SET usado = TRUE, pedido_id = p_pedido_id, usado_at = NOW(), orden = NULL
                WHERE id = v_codigo_id;

                UPDATE public.pedido_items 
                SET codigo_entregado = v_codigo_asignado, estado = 'completado'
                WHERE id = v_item.id;
                
                v_alguna_entrega := TRUE;
            ELSE
                v_todos_automaticos := FALSE;
            END IF;
        ELSE
            v_todos_automaticos := FALSE;
        END IF;
    END LOOP;

    IF v_alguna_entrega THEN
        UPDATE public.pedidos 
        SET estado = 'completado', 
            venta_registrada = TRUE, 
            atendido_por_id = v_superadmin_id,
            fecha_respuesta = NOW(),
            updated_at = NOW()
        WHERE id = p_pedido_id;
        
        RETURN json_build_object('success', TRUE, 'completado', v_todos_automaticos, 'mensaje', 'Código entregado automáticamente');
    END IF;

    RETURN json_build_object('success', FALSE, 'error', 'Sin stock disponible');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función RPC para actualizar el orden de los códigos en bloque
CREATE OR REPLACE FUNCTION public.actualizar_orden_codigos_rpc(p_updates JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_item JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates) LOOP
        UPDATE public.producto_codigos
        SET orden = (v_item->>'orden')::INT
        WHERE id = (v_item->>'id')::INT AND usado = FALSE;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
