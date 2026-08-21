-- Migration: 225_fix_rpc_ocr_recargas.sql
-- Description: Restaura la lógica de OCR y establece la tolerancia a 2.0 Bs para la auto-aprobación de recargas.

CREATE OR REPLACE FUNCTION intentar_auto_aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_ocr_referencia TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_apk_pago RECORD;
    v_recarga RECORD;
BEGIN
    -- Limpiar la referencia
    p_referencia := TRIM(p_referencia);
    IF p_ocr_referencia IS NOT NULL THEN
        p_ocr_referencia := TRIM(p_ocr_referencia);
    END IF;

    -- 1. Buscar en pagos_apk un pago disponible que coincida en referencia u OCR
    SELECT * INTO v_apk_pago 
    FROM public.pagos_apk 
    WHERE (referencia = p_referencia OR (p_ocr_referencia IS NOT NULL AND referencia = p_ocr_referencia))
    AND status = 'disponible' 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró un pago APK disponible con esta referencia.');
    END IF;

    -- 2. Verificar que el monto coincida (margen de error 2.0 Bs)
    IF ABS(v_apk_pago.monto - p_monto) > 2.0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El monto del pago APK no coincide dentro de la tolerancia de 2 Bs.');
    END IF;

    -- 3. Buscar la recarga
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
        SET estado = 'aprobado', updated_at = NOW(), referencia_pago = p_ocr_referencia
        WHERE id = p_recarga_id;
    ELSE
        UPDATE public.billetera_recargas
        SET estado = 'aprobado', updated_at = NOW()
        WHERE id = p_recarga_id;
    END IF;

    -- 6. Insertar transacción
    INSERT INTO public.billetera_transacciones (
        auth_user_id, tipo, monto, moneda, descripcion, referencia_id
    ) VALUES (
        v_recarga.auth_user_id, 'recarga', v_recarga.monto, COALESCE(v_recarga.moneda, 'usd'), 
        'Recarga automática de saldo vía Pago APK', 
        p_recarga_id
    );

    -- 7. Actualizar billetera
    IF COALESCE(v_recarga.moneda, 'usd') = 'usd' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (v_recarga.auth_user_id, v_recarga.monto, 0)
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET saldo = public.billeteras.saldo + EXCLUDED.saldo;
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (v_recarga.auth_user_id, 0, v_recarga.monto)
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + EXCLUDED.saldo_bs;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Recarga auto-aprobada con éxito.');
END;
$$;
