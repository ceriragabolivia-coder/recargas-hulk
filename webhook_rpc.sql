-- Función para actualizar el estado del pedido desde el webhook saltando el RLS
CREATE OR REPLACE FUNCTION webhook_update_pedido(
    p_pedido_id INT,
    p_estado TEXT,
    p_pago_verificado BOOLEAN DEFAULT NULL,
    p_venta_registrada BOOLEAN DEFAULT NULL,
    p_fecha_respuesta TIMESTAMPTZ DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.pedidos
    SET 
        estado = COALESCE(p_estado, estado),
        pago_verificado = COALESCE(p_pago_verificado, pago_verificado),
        venta_registrada = COALESCE(p_venta_registrada, venta_registrada),
        fecha_respuesta = COALESCE(p_fecha_respuesta, fecha_respuesta),
        updated_at = NOW()
    WHERE id = p_pedido_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar el estado del item del pedido desde el webhook saltando el RLS
CREATE OR REPLACE FUNCTION webhook_update_pedido_item(
    p_item_id INT,
    p_estado_proveedor TEXT,
    p_mensaje_proveedor TEXT DEFAULT NULL,
    p_proveedor_pedido_id BIGINT DEFAULT NULL,
    p_estado TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.pedido_items
    SET 
        estado_proveedor = COALESCE(p_estado_proveedor, estado_proveedor),
        mensaje_proveedor = COALESCE(p_mensaje_proveedor, mensaje_proveedor),
        proveedor_pedido_id = COALESCE(p_proveedor_pedido_id, proveedor_pedido_id),
        estado = COALESCE(p_estado, estado)
    WHERE id = p_item_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
