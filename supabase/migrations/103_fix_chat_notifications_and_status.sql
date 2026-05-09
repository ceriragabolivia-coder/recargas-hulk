-- Migración 103: Notificaciones de Chat y Desbloqueo de Soporte
-- Objetivo: Asegurar que el usuario reciba una notificación push cuando un admin le escribe
-- y que su chat se desbloquee automáticamente (status = 'pendiente').

-- 1. Función para manejar nuevos mensajes de soporte
CREATE OR REPLACE FUNCTION public.handle_support_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_auth_id UUID;
    v_cliente_nombre TEXT;
BEGIN
    -- Obtenemos el auth_user_id del cliente asociado al mensaje
    SELECT auth_user_id, nombres INTO v_cliente_auth_id, v_cliente_nombre
    FROM public.clientes
    WHERE id = NEW.cliente_id;

    -- Solo procedemos si el mensaje viene de un administrador (es_admin = true)
    IF NEW.es_admin = true AND v_cliente_auth_id IS NOT NULL THEN
        
        -- A. Insertar notificación para el usuario
        INSERT INTO public.notificaciones_usuarios (
            user_id,
            titulo,
            mensaje,
            tipo,
            leido,
            created_at
        ) VALUES (
            v_cliente_auth_id,
            '💬 Nuevo mensaje de soporte',
            'Un administrador ha respondido a tu solicitud. Haz clic para ver el mensaje.',
            'chat',
            false,
            now()
        );

        -- B. Desbloquear el chat del cliente (ponerlo en pendiente para que vea el input)
        UPDATE public.clientes
        SET soporte_status = 'pendiente'
        WHERE id = NEW.cliente_id;
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger para soporte_mensajes
DROP TRIGGER IF EXISTS trig_support_message_noti ON public.soporte_mensajes;
CREATE TRIGGER trig_support_message_noti
AFTER INSERT ON public.soporte_mensajes
FOR EACH ROW
EXECUTE FUNCTION public.handle_support_message_notification();

-- 3. Nota: Asegurar que Realtime esté habilitado para notificaciones_usuarios vía el Dashboard de Supabase.
-- (Ya que ALTER PUBLICATION puede fallar si la tabla ya es miembro)
