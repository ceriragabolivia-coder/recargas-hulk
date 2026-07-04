-- ==============================================================================
-- Migration: 149_fix_timezone_defaults
-- Description: Corrige el desfase de 4 horas en la creación de pedidos causado 
-- por la doble aplicación de la zona horaria en columnas TIMESTAMPTZ.
-- ==============================================================================

-- 1. Corregir los valores por defecto en la tabla `pedidos`
ALTER TABLE public.pedidos ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.pedidos ALTER COLUMN updated_at SET DEFAULT NOW();

-- 2. Corregir los valores por defecto en `referencias_pagos_control`
ALTER TABLE public.referencias_pagos_control ALTER COLUMN created_at SET DEFAULT NOW();

-- 3. Actualizar los pedidos existentes que tengan el desfase de 4 horas
-- (Los pedidos se crearon con 4 horas de retraso porque Postgres los almacenaba como UTC pero con la hora de Caracas)
UPDATE public.pedidos 
SET created_at = created_at + INTERVAL '4 hours'
WHERE created_at < NOW();

-- Actualizamos el updated_at si nunca fue modificado desde el frontend 
-- (Si el frontend lo actualizó, usó toISOString() que es UTC correcto, por lo que no debemos tocarlo si es muy diferente al created_at original)
UPDATE public.pedidos
SET updated_at = updated_at + INTERVAL '4 hours'
WHERE estado = 'pendiente' OR ABS(EXTRACT(EPOCH FROM (updated_at - (created_at - INTERVAL '4 hours')))) < 2;

-- 4. Actualizar la tabla de control de referencias
UPDATE public.referencias_pagos_control 
SET created_at = created_at + INTERVAL '4 hours'
WHERE created_at < NOW();

-- 5. Reemplazar la función RPC que validaba referencias para usar NOW() correctamente en lugar de (NOW() AT TIME ZONE)
CREATE OR REPLACE FUNCTION public.validar_y_registrar_referencia_rpc(
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_origen TEXT
) RETURNS JSONB AS $$
DECLARE
    v_existe_control BOOLEAN;
    v_rechazado_pedido BOOLEAN;
    v_rechazado_billetera BOOLEAN;
BEGIN
    -- Limpiar la referencia
    p_referencia := TRIM(p_referencia);

    -- 1. Verificar si existe en la tabla de control (Duplicada)
    SELECT EXISTS (
        SELECT 1 FROM public.referencias_pagos_control
        WHERE referencia = p_referencia
        AND created_at > NOW() - INTERVAL '48 hours'
    ) INTO v_existe_control;

    -- 2. Verificar si existe en pedidos como RECHAZADO (pago_verificado = false)
    SELECT EXISTS (
        SELECT 1 FROM public.pedidos
        WHERE (referencia_pago = p_referencia OR referencia_pago LIKE p_referencia || ' %')
        AND pago_verificado = false
        AND created_at > NOW() - INTERVAL '48 hours'
    ) INTO v_rechazado_pedido;

    -- 3. Verificar si existe en billetera_recargas como RECHAZADO
    SELECT EXISTS (
        SELECT 1 FROM public.billetera_recargas
        WHERE (referencia_pago = p_referencia OR referencia_pago LIKE p_referencia || ' %')
        AND estado = 'rechazado'
        AND created_at > NOW() - INTERVAL '48 hours'
    ) INTO v_rechazado_billetera;

    -- Priorizar el mensaje de rechazo si aplica
    IF v_rechazado_pedido OR v_rechazado_billetera THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Referencia Rechazada', 
            'detail', 'Esta referencia fue rechazada anteriormente por ser inválida o inexistente. No puedes volver a usarla.'
        );
    END IF;

    IF v_existe_control THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Referencia Duplicada',
            'detail', 'Esta referencia ya ha sido registrada en las últimas 48 horas.'
        );
    END IF;

    -- Si no existe ni está rechazada, registrarla en el control
    INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen)
    VALUES (p_referencia, p_monto, p_usuario_id, p_origen);

    RETURN jsonb_build_object('success', true, 'message', 'Referencia válida y registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
