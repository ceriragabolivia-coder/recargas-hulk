-- Migration: 181_beneficios_extra_metodos_pago.sql
-- Description: Añade la columna beneficios_extra a metodos_pago y actualiza las funciones de aprobación.

ALTER TABLE public.metodos_pago ADD COLUMN IF NOT EXISTS beneficios_extra JSONB DEFAULT '{}'::jsonb;

-- 1. Actualizar la función de aprobación manual (aprobar_recarga_rpc)
CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_moneda TEXT;
    v_metodo_id UUID;
    v_beneficios_extra JSONB;
    v_str_amount TEXT;
    v_porcentaje_extra NUMERIC := 0;
    v_monto_extra NUMERIC := 0;
    v_monto_total NUMERIC;
BEGIN
    -- SEGURIDAD: Solo un ADMIN real puede aprobar
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No tienes permisos de administrador para realizar esta acción.';
    END IF;

    -- Check if recharge is pending
    SELECT auth_user_id, monto, COALESCE(moneda, 'usd'), metodo_pago_id
    INTO v_user_id, v_amount, v_moneda, v_metodo_id
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN 
        RETURN FALSE; 
    END IF;

    -- Obtener beneficios extra configurados
    SELECT beneficios_extra INTO v_beneficios_extra
    FROM public.metodos_pago
    WHERE id = v_metodo_id;

    -- Calcular bono si el monto exacto está configurado (e.g. "25", "25.00")
    -- Probaremos con la versión sin decimales si es entero, o con el numero normal convertido a texto.
    v_str_amount := REPLACE(v_amount::TEXT, '.00', ''); 
    
    IF v_beneficios_extra IS NOT NULL AND v_beneficios_extra ? v_str_amount THEN
        v_porcentaje_extra := (v_beneficios_extra->>v_str_amount)::NUMERIC;
        IF v_porcentaje_extra > 0 THEN
            v_monto_extra := v_amount * (v_porcentaje_extra / 100);
        END IF;
    END IF;

    v_monto_total := v_amount + v_monto_extra;

    -- Mark as approved
    UPDATE public.billetera_recargas
    SET estado = 'aprobado', 
        atendido_por_id = auth.uid(), 
        notas_admin = p_notas, 
        updated_at = now()
    WHERE id = p_recarga_id;

    -- Update or Insert wallet balance based on currency, utilizando v_monto_total
    IF v_moneda = 'bs' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_user_id, 0, v_monto_total)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + v_monto_total, updated_at = now();
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo)
        VALUES (v_user_id, v_monto_total)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo = public.billeteras.saldo + v_monto_total, updated_at = now();
    END IF;

    -- Log Transaction (monto original reportado en la recarga, y si hay bono un detalle extra o logeado junto)
    -- Lo logeamos junto para que el cliente vea el monto final ingresado
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (v_user_id, v_monto_total, 'recarga', 
            CASE WHEN v_monto_extra > 0 THEN 'Recarga de billetera aprobada (Incluye ' || v_porcentaje_extra || '% de bono)' ELSE 'Recarga de billetera aprobada' END, 
            p_recarga_id, v_moneda);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Actualizar la función de auto-aprobación (intentar_auto_aprobar_recarga_rpc)
CREATE OR REPLACE FUNCTION intentar_auto_aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_apk_pago RECORD;
    v_recarga RECORD;
    v_beneficios_extra JSONB;
    v_str_amount TEXT;
    v_porcentaje_extra NUMERIC := 0;
    v_monto_extra NUMERIC := 0;
    v_monto_total NUMERIC;
BEGIN
    -- Limpiar la referencia
    p_referencia := TRIM(p_referencia);

    -- Buscar en pagos_apk un pago disponible que coincida en referencia
    SELECT * INTO v_apk_pago 
    FROM public.pagos_apk 
    WHERE referencia = p_referencia 
    AND status = 'disponible' 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró un pago APK disponible con esta referencia.');
    END IF;

    -- Verificar que el monto coincida (margen de error 0.05)
    IF ABS(v_apk_pago.monto - p_monto) > 0.05 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El monto del pago APK no coincide.');
    END IF;

    -- Buscar la recarga
    SELECT * INTO v_recarga FROM public.billetera_recargas WHERE id = p_recarga_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Recarga no encontrada.');
    END IF;

    IF v_recarga.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('success', false, 'message', 'La recarga ya no está pendiente.');
    END IF;

    -- Obtener beneficios extra configurados en el metodo_pago
    SELECT beneficios_extra INTO v_beneficios_extra
    FROM public.metodos_pago
    WHERE id = v_recarga.metodo_pago_id;

    v_str_amount := REPLACE(v_recarga.monto::TEXT, '.00', ''); 
    
    IF v_beneficios_extra IS NOT NULL AND v_beneficios_extra ? v_str_amount THEN
        v_porcentaje_extra := (v_beneficios_extra->>v_str_amount)::NUMERIC;
        IF v_porcentaje_extra > 0 THEN
            v_monto_extra := v_recarga.monto * (v_porcentaje_extra / 100);
        END IF;
    END IF;

    v_monto_total := v_recarga.monto + v_monto_extra;

    -- Marcar el pago APK como usado
    UPDATE public.pagos_apk 
    SET status = 'usado', usuario_id = p_usuario_id 
    WHERE id = v_apk_pago.id;

    -- Aprobar la recarga
    UPDATE public.billetera_recargas
    SET estado = 'aprobado', updated_at = NOW()
    WHERE id = p_recarga_id;

    -- Insertar transacción
    INSERT INTO public.billetera_transacciones (
        auth_user_id, tipo, monto, moneda, descripcion, referencia_id
    ) VALUES (
        v_recarga.auth_user_id, 'recarga', v_monto_total, COALESCE(v_recarga.moneda, 'usd'), 
        CASE WHEN v_monto_extra > 0 THEN 'Recarga automática de saldo vía Pago APK (Incluye ' || v_porcentaje_extra || '% de bono)' ELSE 'Recarga automática de saldo vía Pago APK' END, 
        p_recarga_id
    );

    -- Actualizar billetera
    IF COALESCE(v_recarga.moneda, 'usd') = 'usd' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (v_recarga.auth_user_id, v_monto_total, 0)
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET saldo = public.billeteras.saldo + EXCLUDED.saldo;
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (v_recarga.auth_user_id, 0, v_monto_total)
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + EXCLUDED.saldo_bs;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Recarga auto-aprobada con éxito.');
END;
$$;

NOTIFY pgrst, 'reload schema';
