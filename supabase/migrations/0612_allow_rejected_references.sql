-- Migration: 0612_allow_rejected_references.sql
-- Description: Elimina el bloqueo de referencias rechazadas para permitir que sean usadas de nuevo por pagos reales o reintentos válidos, y asegura que la tabla de control se limpie cuando un admin rechace.

CREATE OR REPLACE FUNCTION public.validar_y_registrar_referencia_rpc(
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_origen TEXT
) RETURNS JSONB AS $$
DECLARE
    v_existe_control BOOLEAN;
BEGIN
    -- Limpiar la referencia
    p_referencia := TRIM(p_referencia);

    -- 1. Verificar si existe en la tabla de control (Duplicada)
    SELECT EXISTS (
        SELECT 1 FROM public.referencias_pagos_control
        WHERE referencia = p_referencia
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_existe_control;

    IF v_existe_control THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Referencia Duplicada',
            'detail', 'Esta referencia ya ha sido registrada en las últimas 48 horas.'
        );
    END IF;

    -- Si no existe en control, registrarla
    INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen)
    VALUES (p_referencia, p_monto, p_usuario_id, p_origen);

    RETURN jsonb_build_object('success', true, 'message', 'Referencia válida y registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger para liberar referencia si una recarga a la billetera es rechazada
CREATE OR REPLACE FUNCTION public.liberar_referencia_rechazada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'rechazado' AND OLD.estado != 'rechazado' THEN
        DELETE FROM public.referencias_pagos_control WHERE referencia = TRIM(NEW.referencia_pago);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_liberar_referencia_rechazada ON public.billetera_recargas;
CREATE TRIGGER trg_liberar_referencia_rechazada
AFTER UPDATE ON public.billetera_recargas
FOR EACH ROW
EXECUTE FUNCTION public.liberar_referencia_rechazada();


-- Trigger para liberar referencia si un pedido es rechazado o cancelado
CREATE OR REPLACE FUNCTION public.liberar_referencia_pedido_rechazado()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.estado = 'rechazado' AND OLD.estado != 'rechazado') OR (NEW.estado = 'cancelado' AND OLD.estado != 'cancelado') THEN
        DELETE FROM public.referencias_pagos_control WHERE referencia = TRIM(NEW.referencia_pago);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_liberar_referencia_pedido_rechazado ON public.pedidos;
CREATE TRIGGER trg_liberar_referencia_pedido_rechazado
AFTER UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.liberar_referencia_pedido_rechazado();
