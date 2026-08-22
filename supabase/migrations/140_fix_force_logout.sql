-- Eliminar etiqueta __FORCE_LOGOUT__ atascada de todos los usuarios
UPDATE public.perfiles
SET motivo_estado = TRIM(REPLACE(motivo_estado, '__FORCE_LOGOUT__', ''))
WHERE motivo_estado LIKE '%__FORCE_LOGOUT__%';

UPDATE public.perfiles
SET motivo_estado = NULL
WHERE motivo_estado = '';

-- Crear función RPC segura para que los usuarios limpien su propia etiqueta sin requerir permisos de UPDATE en toda la tabla
CREATE OR REPLACE FUNCTION clear_force_logout(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo permitir limpiar la etiqueta si el usuario coincide
    IF auth.uid() = p_user_id THEN
        UPDATE public.perfiles
        SET motivo_estado = NULLIF(TRIM(REPLACE(motivo_estado, '__FORCE_LOGOUT__', '')), '')
        WHERE id = p_user_id;
    END IF;
END;
$$;
