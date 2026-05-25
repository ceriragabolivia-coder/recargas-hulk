-- Migración 128: RPC para actualización administrativa de perfil
-- Soluciona el error de RLS al guardar cambios de rol, estado y descuentos.

CREATE OR REPLACE FUNCTION public.admin_update_profile_role(
    p_user_id UUID,
    p_rol TEXT,
    p_estado TEXT,
    p_porcentaje_descuento NUMERIC,
    p_config_modulos JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Validar permisos de administrador (admin o superadmin)
    IF NOT public.is_superadmin() THEN
        SELECT LOWER(rol) INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
        IF v_caller_role NOT IN ('admin', 'administrador') THEN
            RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos para realizar esta acción.');
        END IF;
    END IF;

    -- Actualizar o insertar en perfiles atómicamente ignorando RLS del usuario
    INSERT INTO public.perfiles (id, rol, estado, porcentaje_descuento, config_modulos, updated_at)
    VALUES (p_user_id, p_rol, COALESCE(p_estado, 'aprobado'), p_porcentaje_descuento, p_config_modulos, now())
    ON CONFLICT (id) DO UPDATE 
    SET rol = EXCLUDED.rol, 
        estado = COALESCE(EXCLUDED.estado, public.perfiles.estado), 
        porcentaje_descuento = EXCLUDED.porcentaje_descuento, 
        config_modulos = EXCLUDED.config_modulos, 
        updated_at = now();

    -- Sincronizar estado en la tabla clientes
    IF p_estado IS NOT NULL THEN
        UPDATE public.clientes SET estado = p_estado WHERE auth_user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refrescar el esquema
NOTIFY pgrst, 'reload schema';
