-- ============================================
-- Migración 043: Cronómetro de Pago y Expiración
-- ============================================

-- 1. Añadir configuración de tiempo límite (en minutos)
INSERT INTO public.configuracion (clave, valor, descripcion) 
VALUES ('tiempo_limite_pago', 15, 'Tiempo máximo (minutos) para reportar un pago antes de que el pedido expire')
ON CONFLICT (clave) DO NOTHING;

-- 2. Función para eliminar pedidos expirados que NO tienen referencia de pago
-- Se consideran expirados si: estado = 'pendiente' AND referencia_pago IS NULL AND created_at < (now() - interval 'X minutes')
CREATE OR REPLACE FUNCTION public.cancelar_pedidos_expirados()
RETURNS JSONB AS $$
DECLARE
    v_eliminados INT;
    v_limite_minutos NUMERIC;
BEGIN
    -- Obtener el límite configuración
    SELECT valor INTO v_limite_minutos FROM public.configuracion WHERE clave = 'tiempo_limite_pago';
    IF v_limite_minutos IS NULL THEN v_limite_minutos := 15; END IF;

    -- Eliminar los pedidos (los pedido_items se borran por CASCADE)
    -- Los cupones usados vinculados también se borran si tienen CASCADE, 
    -- o deben ser manejados si se quiere que vuelvan a estar disponibles.
    DELETE FROM public.pedidos 
    WHERE estado = 'pendiente' 
      AND (referencia_pago IS NULL OR referencia_pago = '')
      AND created_at < (NOW() - (v_limite_minutos || ' minutes')::INTERVAL);
    
    GET DIAGNOSTICS v_eliminados = ROW_COUNT;

    -- Notificar al esquema para recargar si es necesario
    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', true,
        'eliminados', v_eliminados,
        'limite_aplicado', v_limite_minutos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS para la función (RPC)
GRANT EXECUTE ON FUNCTION public.cancelar_pedidos_expirados() TO authenticated, anon;
