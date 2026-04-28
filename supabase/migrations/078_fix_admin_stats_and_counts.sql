
-- Migración 078: Mejora de Estadísticas Pro y Sincronización de Conteos
-- Esta función centraliza las métricas de administración con soporte para rangos históricos.

CREATE OR REPLACE FUNCTION public.get_admin_stats(
    p_fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NULL, 
    p_fecha_fin TIMESTAMP WITH TIME ZONE DEFAULT NULL, 
    p_agrupacion TEXT DEFAULT 'day'
)
RETURNS JSON AS $$
DECLARE
    v_registros JSON;
    v_logins JSON;
    v_pedidos JSON;
    v_total_usuarios INTEGER;
BEGIN
    -- 1. Conteo total actual (Sincronizado con tabla clientes)
    SELECT count(*) INTO v_total_usuarios FROM public.clientes;

    -- 2. Tendencia de Registros (Nuevos usuarios)
    SELECT json_agg(t) INTO v_registros FROM (
        SELECT 
            date_trunc(p_agrupacion, fecha_registro) as fecha, 
            count(*) as cantidad
        FROM public.clientes
        WHERE (p_fecha_inicio IS NULL OR fecha_registro >= p_fecha_inicio)
          AND (p_fecha_fin IS NULL OR fecha_registro <= p_fecha_fin)
        GROUP BY 1
        ORDER BY 1
    ) t;

    -- 3. Tendencia de Actividad (Logins)
    SELECT json_agg(t) INTO v_logins FROM (
        SELECT 
            date_trunc(p_agrupacion, created_at) as fecha, 
            count(*) as cantidad
        FROM public.user_activity
        WHERE tipo_evento = 'login'
          AND (p_fecha_inicio IS NULL OR created_at >= p_fecha_inicio)
          AND (p_fecha_fin IS NULL OR created_at <= p_fecha_fin)
        GROUP BY 1
        ORDER BY 1
    ) t;

    -- 4. Tendencia de Pedidos (Ventas exitosas)
    SELECT json_agg(t) INTO v_pedidos FROM (
        SELECT 
            date_trunc(p_agrupacion, created_at) as fecha, 
            count(*) as cantidad
        FROM public.ventas
        WHERE (p_fecha_inicio IS NULL OR created_at >= p_fecha_inicio)
          AND (p_fecha_fin IS NULL OR created_at <= p_fecha_fin)
        GROUP BY 1
        ORDER BY 1
    ) t;

    RETURN json_build_object(
        'total_usuarios', v_total_usuarios,
        'registros', COALESCE(v_registros, '[]'::json),
        'logins', COALESCE(v_logins, '[]'::json),
        'pedidos', COALESCE(v_pedidos, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION public.get_admin_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats TO service_role;
