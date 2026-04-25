-- Migration: 068_fix_config_upsert.sql
-- Description: Create an RPC function to safely upsert configuration values (handling NULL owner_id properly)

CREATE OR REPLACE FUNCTION public.update_config_rpc(
    p_clave TEXT,
    p_valor NUMERIC DEFAULT NULL,
    p_valor_texto TEXT DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Check if record exists
    IF p_owner_id IS NULL THEN
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id IS NULL;
    ELSE
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id = p_owner_id;
    END IF;

    IF FOUND THEN
        -- Update existing
        IF p_owner_id IS NULL THEN
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, valor), 
                valor_texto = COALESCE(p_valor_texto, valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id IS NULL
            RETURNING * INTO v_result;
        ELSE
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, valor), 
                valor_texto = COALESCE(p_valor_texto, valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id = p_owner_id
            RETURNING * INTO v_result;
        END IF;
    ELSE
        -- Insert new
        INSERT INTO public.configuracion (clave, valor, valor_texto, owner_id)
        VALUES (p_clave, p_valor, p_valor_texto, p_owner_id)
        RETURNING * INTO v_result;
    END IF;

    RETURN row_to_json(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_config_rpc(TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload schema';
