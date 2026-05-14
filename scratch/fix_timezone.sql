
-- 1. Corregir los valores predeterminados de la tabla pedidos
ALTER TABLE pedidos 
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW();

-- 2. Corregir los valores predeterminados de la tabla de control de referencias
ALTER TABLE referencias_pagos_control 
ALTER COLUMN created_at SET DEFAULT NOW();

-- 3. Corregir los valores predeterminados de la tabla de ventas
ALTER TABLE ventas 
ALTER COLUMN fecha SET DEFAULT (CURRENT_DATE AT TIME ZONE 'America/Caracas'),
ALTER COLUMN hora SET DEFAULT (CURRENT_TIME AT TIME ZONE 'America/Caracas'),
ALTER COLUMN created_at SET DEFAULT NOW();

-- 4. Corregir el RPC de validación de referencias
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
    p_referencia := TRIM(p_referencia);

    -- 1. Verificar si existe en la tabla de control (Duplicada)
    SELECT EXISTS (
        SELECT 1 FROM public.referencias_pagos_control
        WHERE referencia = p_referencia
        AND created_at > NOW() - INTERVAL '48 hours'
    ) INTO v_existe_control;

    -- 2. Verificar si existe en pedidos como RECHAZADO
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

    IF v_rechazado_pedido OR v_rechazado_billetera THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referencia Rechazada');
    END IF;

    IF v_existe_control THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referencia Duplicada');
    END IF;

    INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen)
    VALUES (p_referencia, p_monto, p_usuario_id, p_origen);

    RETURN jsonb_build_object('success', true, 'message', 'Referencia válida y registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Corregir pedidos recientes que tienen el offset incorrecto (Suma de 4 horas)
UPDATE pedidos 
SET created_at = created_at + INTERVAL '4 hours'
WHERE created_at > (NOW() - INTERVAL '48 hours')
  AND created_at < NOW()
  AND ABS(EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC')) - EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Caracas'))) > 2;

-- 6. Corregir logs de referencias recientes
UPDATE referencias_pagos_control
SET created_at = created_at + INTERVAL '4 hours'
WHERE created_at > (NOW() - INTERVAL '48 hours')
  AND created_at < NOW();

NOTIFY pgrst, 'reload schema';
