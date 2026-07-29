-- Migración 188: Actualizar RPC para perfil
-- Esta función asegura que los nuevos campos de perfil se actualicen correctamente
-- (fecha de nacimiento, estado, género, instagram, facebook, juegos favoritos)

CREATE OR REPLACE FUNCTION public.actualizar_perfil_usuario_rpc(
    p_user_id UUID,
    p_avatar_url TEXT DEFAULT NULL,
    p_nickname TEXT DEFAULT NULL,
    p_whatsapp TEXT DEFAULT NULL,
    p_fecha_nacimiento DATE DEFAULT NULL,
    p_estado TEXT DEFAULT NULL,
    p_genero TEXT DEFAULT NULL,
    p_instagram_link TEXT DEFAULT NULL,
    p_facebook_link TEXT DEFAULT NULL,
    p_juegos_favoritos JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_success BOOLEAN := TRUE;
    v_message TEXT := 'Perfil actualizado correctamente';
BEGIN
    -- 1. Verificar que el usuario solo pueda actualizar su propio perfil
    -- (O si es admin, pero para este caso es para el propio usuario)
    IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'No tienes permiso para actualizar este perfil');
    END IF;

    -- 2. Actualizar tabla perfiles
    UPDATE public.perfiles
    SET 
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        nickname = COALESCE(p_nickname, nickname),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 3. Actualizar tabla clientes
    UPDATE public.clientes
    SET 
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        nickname = COALESCE(p_nickname, nickname),
        whatsapp = COALESCE(p_whatsapp, whatsapp),
        fecha_nacimiento = COALESCE(p_fecha_nacimiento, fecha_nacimiento),
        estado = COALESCE(p_estado, estado),
        genero = COALESCE(p_genero, genero),
        instagram_link = COALESCE(p_instagram_link, instagram_link),
        facebook_link = COALESCE(p_facebook_link, facebook_link),
        juegos_favoritos = COALESCE(p_juegos_favoritos, juegos_favoritos)
    WHERE auth_user_id = p_user_id;

    RETURN json_build_object('success', true, 'message', v_message);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
