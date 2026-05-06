-- 093_order_notifications_trigger.sql
-- Trigger to notify users when their order status changes

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_titulo TEXT;
    v_mensaje TEXT;
BEGIN
    -- Solo actuar si el estado ha cambiado
    IF (OLD.estado IS DISTINCT FROM NEW.estado) THEN
        
        -- Definir títulos y mensajes según el estado
        IF (NEW.estado = 'completado') THEN
            v_titulo := '✅ Pedido Completado';
            v_mensaje := 'Tu pedido #' || NEW.numero_pedido || ' ha sido procesado exitosamente. ¡Gracias por tu compra!';
        ELSIF (NEW.estado = 'cancelado' OR NEW.estado = 'rechazado') THEN
            v_titulo := '❌ Pedido Cancelado';
            v_mensaje := 'Tu pedido #' || NEW.numero_pedido || ' ha sido cancelado o rechazado. Contacta a soporte para más detalles.';
        ELSIF (NEW.estado = 'procesando') THEN
            v_titulo := '⏳ Pedido en Proceso';
            v_mensaje := 'Estamos trabajando en tu pedido #' || NEW.numero_pedido || '. Te avisaremos cuando esté listo.';
        ELSE
            -- Para otros estados no generamos notificación por ahora o usamos uno genérico
            RETURN NEW;
        END IF;

        -- Insertar la notificación
        INSERT INTO notificaciones_usuarios (user_id, titulo, mensaje, tipo, metadata)
        VALUES (
            NEW.cliente_id, 
            v_titulo, 
            v_mensaje, 
            'order_status', 
            jsonb_build_object('pedido_id', NEW.id, 'numero_pedido', NEW.numero_pedido, 'nuevo_estado', NEW.estado)
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS trig_order_status_notification ON pedidos;
CREATE TRIGGER trig_order_status_notification
AFTER UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION notify_order_status_change();
