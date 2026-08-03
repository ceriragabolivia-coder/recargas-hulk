-- Migración 189: Recompensa por perfil completo

-- 1. Agregamos el flag a la tabla clientes para saber si ya se le otorgó la recompensa
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS recompensa_perfil_otorgada BOOLEAN DEFAULT FALSE;

-- 2. Creamos la función RPC que otorga el cupón y actualiza el perfil
CREATE OR REPLACE FUNCTION public.otorgar_recompensa_perfil_rpc(
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_cupon RECORD;
    v_ya_otorgada BOOLEAN;
BEGIN
    -- Verificar si el usuario ya recibió la recompensa
    SELECT recompensa_perfil_otorgada INTO v_ya_otorgada FROM public.clientes WHERE auth_user_id = p_user_id;
    
    IF v_ya_otorgada THEN
        RETURN json_build_object('success', false, 'message', 'La recompensa ya fue otorgada a este usuario');
    END IF;

    -- Buscar o crear el cupón PERFIL-COMPLETO
    SELECT * INTO v_cupon FROM public.cupones WHERE codigo = 'PERFIL-COMPLETO';
    
    IF NOT FOUND THEN
        -- Crear el cupón si no existe
        INSERT INTO public.cupones (
            codigo, 
            porcentaje_descuento, 
            activo, 
            max_usos_usuario
        ) VALUES (
            'PERFIL-COMPLETO', 
            5, 
            TRUE, 
            1
        ) RETURNING * INTO v_cupon;
    END IF;

    -- Asignar el cupón al usuario
    IF NOT EXISTS (SELECT 1 FROM public.cupones_usuarios WHERE cupon_id = v_cupon.id AND usuario_id = p_user_id) THEN
        INSERT INTO public.cupones_usuarios (cupon_id, usuario_id, usos)
        VALUES (v_cupon.id, p_user_id, 0);
    END IF;

    -- Marcar la recompensa como otorgada
    UPDATE public.clientes
    SET recompensa_perfil_otorgada = TRUE
    WHERE auth_user_id = p_user_id;

    RETURN json_build_object('success', true, 'message', 'Recompensa otorgada correctamente');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
