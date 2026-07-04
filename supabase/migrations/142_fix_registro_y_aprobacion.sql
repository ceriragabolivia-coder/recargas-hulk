-- Migration 142: Corregir Registro y Sistema de Aprobación
-- PROBLEMA: handle_new_user insertaba estado='' en clientes (causa el error "Email address is invalid")
-- SOLUCIÓN: Usar siempre 'pendiente' como estado inicial + manejo de errores robusto

-- ============================================================
-- 1. CORREGIR TRIGGER handle_new_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- 1. Crear perfil con estado pendiente (ON CONFLICT para evitar duplicados)
    INSERT INTO public.perfiles (id, rol, estado)
    VALUES (new.id, 'cliente', 'pendiente')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Crear registro en clientes (con manejo de errores para no bloquear el registro)
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
            fecha_registro
        ) VALUES (
            new.id,
            new.email,
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'nombres'), ''), split_part(new.email, '@', 1)),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'apellidos'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'nickname'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'whatsapp'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'pais'), ''), 'Venezuela'),
            'pendiente',   -- SIEMPRE 'pendiente', nunca vacío ni del metadata
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Si el cliente ya existe (edge case), vincular el auth_user_id
        BEGIN
            UPDATE public.clientes 
            SET auth_user_id = new.id, estado = 'pendiente' 
            WHERE LOWER(usuario) = LOWER(new.email) AND auth_user_id IS NULL;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignorar cualquier error secundario
        END;
    END;

    -- 3. Notificar a admins (NO bloquea el registro si falla)
    BEGIN
        INSERT INTO public.notificaciones_admin (titulo, mensaje, tipo, metadata)
        VALUES (
            '🆕 Nuevo Usuario Registrado',
            'El usuario ' || new.email || ' se ha registrado y está pendiente de aprobación.',
            'new_user',
            jsonb_build_object('user_id', new.id, 'email', new.email, 'nombres', new.raw_user_meta_data->>'nombres')
        );
    EXCEPTION WHEN OTHERS THEN
        NULL; -- No bloquear el registro si la notificación falla
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. CORREGIR rpc_aprobar_usuario PARA ACEPTAR p_motivo
--    (el hook lo llamaba con 3 params pero la función solo aceptaba 2)
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_aprobar_usuario(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_aprobar_usuario(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_aprobar_usuario(
    p_user_id UUID,
    p_status  TEXT,
    p_motivo  TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    -- Verificar permisos: superadmin o admin/empleado
    IF NOT public.is_superadmin() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid()
              AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Permiso denegado');
        END IF;
    END IF;

    -- Actualizar perfil
    INSERT INTO public.perfiles (id, estado, rol, motivo_estado, updated_at)
    VALUES (p_user_id, p_status, 'cliente', p_motivo, now())
    ON CONFLICT (id) DO UPDATE SET
        estado        = EXCLUDED.estado,
        motivo_estado = CASE 
                            WHEN EXCLUDED.motivo_estado IS NOT NULL THEN EXCLUDED.motivo_estado 
                            ELSE public.perfiles.motivo_estado 
                        END,
        updated_at    = now();

    -- Actualizar cliente
    UPDATE public.clientes
    SET estado = p_status
    WHERE auth_user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Usuario actualizado a ' || p_status);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. GRANT permisos
-- ============================================================
GRANT EXECUTE ON FUNCTION public.rpc_aprobar_usuario(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. Recargar esquema PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
