-- Migration to add a function to check for existing email and whatsapp before registration

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
    SELECT EXISTS(
        SELECT 1 FROM public.clientes WHERE lower(usuario) = lower(p_email)
    ) INTO v_email_exists;

    -- Verificar si existe el whatsapp en clientes
    SELECT EXISTS(
        SELECT 1 FROM public.clientes WHERE whatsapp = p_whatsapp
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
