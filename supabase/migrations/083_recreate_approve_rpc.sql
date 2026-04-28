
-- Migración 083: Re-creación forzada de la función de aprobación
-- Esta migración asegura que la función existe con los nombres de parámetros exactos.

-- Eliminar versiones previas para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.admin_approve_user(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_approve_user(TEXT, UUID);

-- Crear la función con el orden que parece esperar PostgREST según el error
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id UUID, p_status TEXT)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- 1. Verificación de seguridad (SuperAdmin o Admin)
    IF NOT public.is_superadmin() THEN
        SELECT LOWER(rol) INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
        IF v_caller_role NOT IN ('admin', 'administrador') THEN
            RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos de administrador');
        END IF;
    END IF;

    -- 2. Operación Atómica
    -- Actualizar perfiles (con upsert)
    INSERT INTO public.perfiles (id, estado, rol, updated_at)
    VALUES (p_user_id, p_status, 'cliente', now())
    ON CONFLICT (id) DO UPDATE 
    SET estado = EXCLUDED.estado, updated_at = now();

    -- Actualizar clientes
    UPDATE public.clientes 
    SET estado = p_status 
    WHERE auth_user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Usuario actualizado correctamente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Forzar recarga del esquema
NOTIFY pgrst, 'reload schema';
