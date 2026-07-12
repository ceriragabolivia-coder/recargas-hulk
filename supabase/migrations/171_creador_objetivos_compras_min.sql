-- Migration 171: Agregar compras minimas a objetivos de creadores

ALTER TABLE public.creador_objetivos 
ADD COLUMN IF NOT EXISTS compras_minimas_usuario INTEGER NOT NULL DEFAULT 0;

-- Funcion para obtener el progreso real de los objetivos calculando las compras minimas
CREATE OR REPLACE FUNCTION public.get_creador_objetivos_progreso(p_codigos_ids UUID[])
RETURNS TABLE (
    objetivo_id UUID,
    referidos_validos BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        obj.id as objetivo_id,
        (
            SELECT COUNT(DISTINCT c.auth_user_id)
            FROM public.clientes c
            WHERE (
                (obj.codigo_id IS NOT NULL AND c.creador_codigo_id = obj.codigo_id)
                OR
                (obj.codigo_id IS NULL AND c.creador_codigo_id = ANY(p_codigos_ids))
            )
            AND (
                obj.compras_minimas_usuario = 0 
                OR 
                (SELECT COUNT(*) FROM public.pedidos p WHERE p.cliente_id = c.auth_user_id AND p.estado = 'completado') >= obj.compras_minimas_usuario
            )
        ) as referidos_validos
    FROM public.creador_objetivos obj
    WHERE obj.codigo_id IS NULL OR obj.codigo_id = ANY(p_codigos_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificar para recargar esquema
NOTIFY pgrst, 'reload schema';
