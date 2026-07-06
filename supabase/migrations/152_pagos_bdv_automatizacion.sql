-- =============================================================================
-- Migration: 152_pagos_bdv_automatizacion.sql
-- Description: Crea la estructura para almacenar y procesar notificaciones
--              de pago móvil del BDV provenientes de la app Android.
-- =============================================================================

-- 1. Crear tabla para almacenar las notificaciones del BDV
CREATE TABLE IF NOT EXISTS public.pagos_bdv_notificaciones (
    id SERIAL PRIMARY KEY,
    referencia TEXT NOT NULL,
    monto_bs NUMERIC NOT NULL,
    fecha TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas'),
    texto_original TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'procesado', 'ignorado'
    pedido_id INT REFERENCES public.pedidos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas')
);

-- Índices para búsqueda rápida (se buscará frecuentemente por referencia y estado)
CREATE INDEX IF NOT EXISTS idx_pagos_bdv_ref_estado ON public.pagos_bdv_notificaciones(referencia, estado);

-- Habilitar RLS
ALTER TABLE public.pagos_bdv_notificaciones ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden gestionar esta tabla (el webhook usará el service role)
DROP POLICY IF EXISTS "Admins manage bdv payments" ON public.pagos_bdv_notificaciones;
CREATE POLICY "Admins manage bdv payments" ON public.pagos_bdv_notificaciones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
        )
    );

-- 2. Función para intentar procesar un pago BDV pendiente
-- Se llama cuando entra un nuevo pedido o una nueva notificación
CREATE OR REPLACE FUNCTION public.procesar_notificacion_bdv_rpc(
    p_referencia TEXT,
    p_monto_bs NUMERIC,
    p_texto_original TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_pedido_id INT;
    v_pedido_total NUMERIC;
    v_notificacion_id INT;
    v_resultado JSON;
    v_procesado BOOLEAN := FALSE;
BEGIN
    -- Insertar la notificación como pendiente inicialmente
    INSERT INTO public.pagos_bdv_notificaciones (referencia, monto_bs, texto_original, estado)
    VALUES (p_referencia, p_monto_bs, p_texto_original)
    RETURNING id INTO v_notificacion_id;

    -- Buscar si hay un pedido pendiente con esta referencia EXACTA (asumiendo que los últimos N dígitos coinciden)
    -- y que el monto coincida (o al menos que el monto pagado sea igual o superior)
    -- Por seguridad requerimos que el estado sea pendiente
    SELECT id, total_bs INTO v_pedido_id, v_pedido_total
    FROM public.pedidos
    WHERE referencia_pago = p_referencia
      AND estado = 'pendiente'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Si encontramos un pedido y el monto coincide (damos un margen muy pequeño de error por redondeos)
    IF v_pedido_id IS NOT NULL AND (p_monto_bs >= (v_pedido_total - 0.5) AND p_monto_bs <= (v_pedido_total + 0.5)) THEN
        
        -- Vincular
        UPDATE public.pagos_bdv_notificaciones
        SET estado = 'procesado', pedido_id = v_pedido_id
        WHERE id = v_notificacion_id;
        
        -- Ejecutar el auto-procesamiento existente (el que llama a las APIs de recarga)
        PERFORM public.procesar_pedido_automatico_rpc(v_pedido_id);
        
        v_procesado := TRUE;
    END IF;

    v_resultado := json_build_object(
        'success', TRUE,
        'notificacion_id', v_notificacion_id,
        'procesado', v_procesado,
        'pedido_asociado', v_pedido_id
    );

    RETURN v_resultado;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
