-- Migration to update the check_registration_data function
-- Ignora la restricción de whatsapp si el usuario fue eliminado definitivamente (auth_user_id IS NULL)

CREATE OR REPLACE FUNCTION public.check_registration_data(p_email TEXT, p_whatsapp TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email_exists BOOLEAN;
    v_whatsapp_exists BOOLEAN;
BEGIN
    -- Verificar si existe el email en clientes (activos, baneados, etc.)
    -- Aquí verificamos normalmente porque el email sí tiene un UNIQUE en la DB.
    SELECT EXISTS(
        SELECT 1 FROM public.clientes WHERE lower(usuario) = lower(p_email)
    ) INTO v_email_exists;

    -- Verificar si existe el whatsapp en clientes
    -- Ignoramos los clientes que fueron eliminados definitivamente (auth_user_id IS NULL)
    SELECT EXISTS(
        SELECT 1 FROM public.clientes WHERE whatsapp = p_whatsapp AND auth_user_id IS NOT NULL
    ) INTO v_whatsapp_exists;

    RETURN json_build_object(
        'email_exists', v_email_exists,
        'whatsapp_exists', v_whatsapp_exists
    );
END;
$$;

-- Permitir el acceso anónimo
GRANT EXECUTE ON FUNCTION public.check_registration_data(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_registration_data(TEXT, TEXT) TO authenticated;
