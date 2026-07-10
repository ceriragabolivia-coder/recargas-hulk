-- Migración 156: Corregir Trigger de Mensajes de Soporte
-- Evita que los mensajes del sistema (como "TICKET CERRADO") vuelvan a abrir un chat resuelto.

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

    -- Verificamos si el remitente es un administrador y si el mensaje NO es un mensaje del sistema
    IF EXISTS (
        SELECT 1 FROM public.clientes c
        JOIN public.perfiles p ON c.auth_user_id = p.id
        WHERE c.id = NEW.remitente_id AND p.rol = 'admin'
    ) AND v_cliente_auth_id IS NOT NULL THEN
        
        -- Si es un mensaje del sistema, NO generamos notificación push ni cambiamos el estado
        IF NEW.es_sistema = true THEN
            RETURN NEW;
        END IF;

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

-- Notificar al esquema
NOTIFY pgrst, 'reload schema';
