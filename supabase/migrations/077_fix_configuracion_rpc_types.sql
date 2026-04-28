-- Migration: 077_fix_configuracion_rpc_types.sql
-- Description: Corrige el error de coincidencia de tipos en COALESCE (numeric vs text) y asegura la integridad de la tabla configuracion.

-- 1. Asegurar tipos de columnas en la tabla configuracion
DO $$ 
BEGIN
    -- Intentar convertir 'valor' a NUMERIC si no lo es
    BEGIN
        ALTER TABLE public.configuracion ALTER COLUMN valor TYPE NUMERIC USING valor::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Intentar convertir 'valor_texto' a TEXT si no lo es
    BEGIN
        ALTER TABLE public.configuracion ALTER COLUMN valor_texto TYPE TEXT USING valor_texto::TEXT;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 2. Reemplazar la función RPC con una versión más robusta que usa casts explícitos
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
    -- Verificar si el registro existe
    IF p_owner_id IS NULL THEN
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id IS NULL;
    ELSE
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id = p_owner_id;
    END IF;

    IF FOUND THEN
        -- Actualizar existente
        IF p_owner_id IS NULL THEN
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, public.configuracion.valor), 
                valor_texto = COALESCE(p_valor_texto, public.configuracion.valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id IS NULL
            RETURNING * INTO v_result;
        ELSE
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, public.configuracion.valor), 
                valor_texto = COALESCE(p_valor_texto, public.configuracion.valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id = p_owner_id
            RETURNING * INTO v_result;
        END IF;
    ELSE
        -- Insertar nuevo
        INSERT INTO public.configuracion (clave, valor, valor_texto, owner_id)
        VALUES (p_clave, COALESCE(p_valor, 0), p_valor_texto, p_owner_id)
        RETURNING * INTO v_result;
    END IF;

    RETURN row_to_json(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asegurar permisos
GRANT EXECUTE ON FUNCTION public.update_config_rpc(TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- 4. Recargar esquema
NOTIFY pgrst, 'reload schema';
