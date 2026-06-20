-- Migration: 058_check_rejected_references.sql
-- Description: Mejora el sistema de control de referencias para detectar específicamente referencias rechazadas en las últimas 48 horas.

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
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_existe_control;

    -- 2. Verificar si existe en pedidos como RECHAZADO (pago_verificado = false)
    SELECT EXISTS (
        SELECT 1 FROM public.pedidos
        WHERE (referencia_pago = p_referencia OR referencia_pago LIKE p_referencia || ' %')
        AND pago_verificado = false
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_rechazado_pedido;

    -- 3. Verificar si existe en billetera_recargas como RECHAZADO
    SELECT EXISTS (
        SELECT 1 FROM public.billetera_recargas
        WHERE (referencia_pago = p_referencia OR referencia_pago LIKE p_referencia || ' %')
        AND estado = 'rechazado'
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
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
