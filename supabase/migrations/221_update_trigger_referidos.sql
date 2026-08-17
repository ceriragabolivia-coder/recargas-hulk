-- 221_update_trigger_referidos.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_creador_codigo TEXT;
    v_creador_id UUID;
    v_codigo_referido TEXT;
    v_referido_por_cliente_id UUID;
BEGIN
    -- 1. Crear perfil con estado pendiente
    INSERT INTO public.perfiles (id, rol, estado)
    VALUES (new.id, 'cliente', 'pendiente')
    ON CONFLICT (id) DO NOTHING;

    -- Extraer codigo de creador si existe
    v_creador_codigo := NULLIF(TRIM(new.raw_user_meta_data->>'creador_codigo'), '');
    IF v_creador_codigo IS NOT NULL THEN
        SELECT id INTO v_creador_id FROM public.codigos_creadores WHERE codigo = UPPER(v_creador_codigo) AND activo = true AND usos_totales < limite_global;
    END IF;
    
    -- Extraer codigo de referido (Sistema de Referidos Normal) si existe
    v_codigo_referido := NULLIF(TRIM(new.raw_user_meta_data->>'codigo_referencia'), '');
    IF v_codigo_referido IS NOT NULL THEN
        SELECT id INTO v_referido_por_cliente_id FROM public.clientes WHERE codigo_referido_propio = v_codigo_referido LIMIT 1;
    END IF;

    -- 2. Crear registro en clientes
    BEGIN
        INSERT INTO public.clientes (
            auth_user_id,
            usuario,
            nombres,
            apellidos,
            nickname,
            whatsapp,
            pais,
            estado,
            fecha_registro,
            creador_codigo_id,
            referido_por_cliente_id
        ) VALUES (
            new.id,
            new.email,
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'nombres'), ''), split_part(new.email, '@', 1)),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'apellidos'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'nickname'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'whatsapp'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'pais'), ''), 'Venezuela'),
            'pendiente',
            NOW(),
            v_creador_id,
            v_referido_por_cliente_id
        );

        -- Incrementar contador de referidos
        IF v_creador_id IS NOT NULL THEN
            UPDATE public.codigos_creadores SET usuarios_registrados = usuarios_registrados + 1 WHERE id = v_creador_id;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        BEGIN
            UPDATE public.clientes 
            SET auth_user_id = new.id, 
                estado = 'pendiente', 
                creador_codigo_id = COALESCE(creador_codigo_id, v_creador_id),
                referido_por_cliente_id = COALESCE(referido_por_cliente_id, v_referido_por_cliente_id)
            WHERE LOWER(usuario) = LOWER(new.email) AND auth_user_id IS NULL;
            
            IF v_creador_id IS NOT NULL AND FOUND THEN
                UPDATE public.codigos_creadores SET usuarios_registrados = usuarios_registrados + 1 WHERE id = v_creador_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    -- 3. Notificar a admins
    BEGIN
        INSERT INTO public.notificaciones_admin (titulo, mensaje, tipo, metadata)
        VALUES (
            '🆕 Nuevo Usuario Registrado',
            'El usuario ' || new.email || ' se ha registrado y está pendiente de aprobación.',
            'new_user',
            jsonb_build_object('user_id', new.id, 'email', new.email, 'nombres', new.raw_user_meta_data->>'nombres')
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN new;
END;
$function$
