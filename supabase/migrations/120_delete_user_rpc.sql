-- Migration to add delete user function

CREATE OR REPLACE FUNCTION public.delete_user_definitivo(p_auth_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar que el ejecutor sea admin
    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles 
        WHERE id = auth.uid() AND rol IN ('admin', 'administrador')
    ) THEN
        RETURN json_build_object('success', false, 'error', 'No tienes permisos para realizar esta acción.');
    END IF;

    -- Eliminar de las tablas publicas primero para evitar conflictos (aunque haya cascade, es buena practica)
    DELETE FROM public.clientes WHERE auth_user_id = p_auth_user_id;
    DELETE FROM public.perfiles WHERE id = p_auth_user_id;
    
    -- Eliminar usuario de la tabla de auth
    DELETE FROM auth.users WHERE id = p_auth_user_id;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_definitivo(UUID) TO authenticated;
