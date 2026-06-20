-- Migration: Fix Configuracion Constraints and RPC
-- Por favor copia y pega todo este código en el SQL Editor de Supabase y córrelo.

-- 1. Eliminar la restricción antigua que impedía a los Negocios tener sus propias claves
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;

-- 2. Eliminar cualquier índice parcial que cause conflictos con upsert
DROP INDEX IF EXISTS public.configuracion_clave_owner_idx;
DROP INDEX IF EXISTS public.configuracion_clave_global_idx;

-- 3. Crear la restricción única correcta para la base de datos
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_owner_key;
ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_owner_key UNIQUE (clave, owner_id);

-- 4. Crear la función RPC para que el sistema pueda guardar de forma segura
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
        -- Insertar nuevo
        INSERT INTO public.configuracion (clave, valor, valor_texto, owner_id)
        VALUES (p_clave, COALESCE(p_valor, 0), p_valor_texto, p_owner_id)
        RETURNING * INTO v_result;
    END IF;

    RETURN row_to_json(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Otorgar permisos
GRANT EXECUTE ON FUNCTION public.update_config_rpc(TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- 6. Recargar caché de esquema
NOTIFY pgrst, 'reload schema';
