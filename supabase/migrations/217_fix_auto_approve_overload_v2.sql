-- Migration: 217_fix_auto_approve_overload_v2.sql

CREATE OR REPLACE FUNCTION public.intentar_auto_aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_ocr_referencia TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_apk_pago RECORD;
    v_recarga RECORD;
BEGIN
    p_referencia := TRIM(p_referencia);
    IF p_ocr_referencia IS NOT NULL THEN
        p_ocr_referencia := TRIM(p_ocr_referencia);
    END IF;

    -- 1. Buscar en pagos_apk un pago disponible que coincida en referencia
    SELECT * INTO v_apk_pago 
    FROM public.pagos_apk 
    WHERE (referencia = p_referencia OR (p_ocr_referencia IS NOT NULL AND referencia = p_ocr_referencia))
    AND status = 'disponible' 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró un pago APK disponible con esta referencia.');
    END IF;

    -- 2. Buscar la recarga
    SELECT * INTO v_recarga FROM public.billetera_recargas WHERE id = p_recarga_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Recarga no encontrada.');
    END IF;

    IF v_recarga.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('success', false, 'message', 'La recarga ya no está pendiente.');
    END IF;

    -- 4. Marcar el pago APK como usado
    UPDATE public.pagos_apk 
    SET status = 'usado', usuario_id = p_usuario_id 
    WHERE id = v_apk_pago.id;

    -- 5. Aprobar la recarga y actualizar referencia si OCR fue la que coincidió
    IF v_apk_pago.referencia = p_ocr_referencia AND p_ocr_referencia != p_referencia THEN
        UPDATE public.billetera_recargas 
        SET estado = 'aprobado', referencia_pago = p_ocr_referencia, updated_at = NOW() 
        WHERE id = p_recarga_id;
    ELSE
        UPDATE public.billetera_recargas 
        SET estado = 'aprobado', updated_at = NOW() 
        WHERE id = p_recarga_id;
    END IF;

    -- 6. Crear la transacción en la billetera
    INSERT INTO public.billetera_transacciones (
        auth_user_id,
        tipo,
        monto,
        moneda,
        descripcion,
        referencia_id
    ) VALUES (
        p_usuario_id,
        'recarga',
        p_monto,
        v_recarga.moneda,
        'Recarga de saldo automática',
        p_recarga_id
    );

    -- 7. Actualizar el saldo del usuario
    IF v_recarga.moneda = 'usd' THEN
        UPDATE public.billeteras 
        SET saldo = saldo + p_monto, updated_at = NOW() 
        WHERE auth_user_id = p_usuario_id;
    ELSE
        UPDATE public.billeteras 
        SET saldo_bs = saldo_bs + p_monto, updated_at = NOW() 
        WHERE auth_user_id = p_usuario_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Recarga aprobada exitosamente.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
