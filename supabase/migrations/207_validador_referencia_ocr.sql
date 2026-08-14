-- Migration: 207_validador_referencia_ocr.sql
-- Description: Actualiza RPCs para validar pagos usando OCR de referencia además de la referencia escrita manualmente.

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

    -- 1. Buscar en pagos_apk un pago disponible que coincida en referencia
    SELECT * INTO v_apk_pago 
    FROM public.pagos_apk 
    WHERE (referencia = p_referencia OR (p_ocr_referencia IS NOT NULL AND referencia = p_ocr_referencia))
    AND status = 'disponible' 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró un pago APK disponible con esta referencia.');
    END IF;

    -- 2. Verificar que el monto coincida (margen de error 0.05)
    IF ABS(v_apk_pago.monto - p_monto) > 0.05 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El monto del pago APK no coincide.');
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

-- Ahora crear_pedido_seguro_rpc
CREATE OR REPLACE FUNCTION public.crear_pedido_seguro_rpc(
    p_pedido_data JSONB,
    p_items_data JSONB,
    p_wallet_usd_deduct NUMERIC DEFAULT 0,
    p_wallet_bs_deduct NUMERIC DEFAULT 0,
    p_existing_pedido_id INT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_current_balance_usd NUMERIC;
    v_current_balance_bs NUMERIC;
    v_pedido_id INT;
    v_pedido RECORD;
    v_item JSONB;
BEGIN
    v_user_id := (p_pedido_data->>'cliente_id')::UUID;
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'cliente_id es requerido');
    END IF;

    IF auth.uid() != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado para crear pedidos a nombre de otro usuario');
    END IF;

    IF p_wallet_usd_deduct > 0 OR p_wallet_bs_deduct > 0 THEN
        SELECT saldo, saldo_bs INTO v_current_balance_usd, v_current_balance_bs
        FROM public.billeteras
        WHERE auth_user_id = v_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Billetera no encontrada');
        END IF;

        IF p_wallet_usd_deduct > 0 THEN
            IF v_current_balance_usd IS NULL OR v_current_balance_usd < p_wallet_usd_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo USD insuficiente en la billetera');
            END IF;
        END IF;

        IF p_wallet_bs_deduct > 0 THEN
            IF v_current_balance_bs IS NULL OR v_current_balance_bs < p_wallet_bs_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo Bs insuficiente en la billetera');
            END IF;
        END IF;

        UPDATE public.billeteras
        SET 
            saldo = saldo - p_wallet_usd_deduct,
            saldo_bs = saldo_bs - p_wallet_bs_deduct,
            updated_at = NOW()
        WHERE auth_user_id = v_user_id;
    END IF;

    IF p_existing_pedido_id IS NOT NULL THEN
        UPDATE public.pedidos
        SET 
            metodo_pago_id = (p_pedido_data->>'metodo_pago_id')::UUID,
            referencia_pago = p_pedido_data->>'referencia_pago',
            total_usd = (p_pedido_data->>'total_usd')::NUMERIC,
            total_bs = (p_pedido_data->>'total_bs')::NUMERIC,
            estado = p_pedido_data->>'estado',
            comprobante_url = p_pedido_data->>'comprobante_url',
            pago_verificado = ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            cupon_id = (p_pedido_data->>'cupon_id')::UUID,
            descuento_cupon_usd = (p_pedido_data->>'descuento_cupon_usd')::NUMERIC,
            descuento_cupon_bs = (p_pedido_data->>'descuento_cupon_bs')::NUMERIC,
            monto_restante_bs = (p_pedido_data->>'monto_restante_bs')::NUMERIC,
            updated_at = NOW()
        WHERE id = p_existing_pedido_id AND cliente_id = v_user_id
        RETURNING * INTO v_pedido;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Pedido existente no encontrado o no autorizado');
        END IF;
        
        v_pedido_id := v_pedido.id;
        DELETE FROM public.pedido_items WHERE pedido_id = v_pedido_id;
    ELSE
        INSERT INTO public.pedidos (
            cliente_id, 
            metodo_pago_id, 
            referencia_pago, 
            total_usd, 
            total_bs, 
            estado, 
            comprobante_url, 
            pago_verificado, 
            cupon_id, 
            descuento_cupon_usd, 
            descuento_cupon_bs,
            monto_restante_bs
        ) VALUES (
            v_user_id,
            (p_pedido_data->>'metodo_pago_id')::UUID,
            p_pedido_data->>'referencia_pago',
            (p_pedido_data->>'total_usd')::NUMERIC,
            (p_pedido_data->>'total_bs')::NUMERIC,
            p_pedido_data->>'estado',
            p_pedido_data->>'comprobante_url',
            ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            (p_pedido_data->>'cupon_id')::UUID,
            (p_pedido_data->>'descuento_cupon_usd')::NUMERIC,
            (p_pedido_data->>'descuento_cupon_bs')::NUMERIC,
            (p_pedido_data->>'monto_restante_bs')::NUMERIC
        ) RETURNING * INTO v_pedido;

        v_pedido_id := v_pedido.id;
    END IF;

    -- NUEVA LÓGICA: Auto-verificar atómicamente contra pagos_apk si la referencia ya llegó
    IF v_pedido.pago_verificado IS NOT TRUE AND v_pedido.referencia_pago != 'N/A' AND v_pedido.referencia_pago NOT LIKE 'PAGO_BILLETERA%' THEN
        DECLARE
            v_apk_pago RECORD;
            v_amount_to_check NUMERIC;
            v_ocr_referencia TEXT;
        BEGIN
            v_ocr_referencia := TRIM(p_pedido_data->>'ocr_referencia_pago');
            IF v_ocr_referencia = '' THEN
                v_ocr_referencia := NULL;
            END IF;

            SELECT * INTO v_apk_pago 
            FROM public.pagos_apk 
            WHERE (
                referencia = v_pedido.referencia_pago 
                OR referencia LIKE v_pedido.referencia_pago || ' |%'
                OR (v_ocr_referencia IS NOT NULL AND (referencia = v_ocr_referencia OR referencia LIKE v_ocr_referencia || ' |%'))
            )
            AND status = 'disponible'
            LIMIT 1;

            IF FOUND THEN
                v_amount_to_check := COALESCE(v_pedido.monto_restante_bs, v_pedido.total_bs);
                IF ABS(v_apk_pago.monto - v_amount_to_check) <= 0.05 THEN
                    -- Si el APK coincidió por ocr_referencia, actualizamos la referencia_pago real en el pedido
                    IF (v_ocr_referencia IS NOT NULL AND (v_apk_pago.referencia = v_ocr_referencia OR v_apk_pago.referencia LIKE v_ocr_referencia || ' |%')) AND v_apk_pago.referencia != v_pedido.referencia_pago THEN
                        UPDATE public.pedidos 
                        SET pago_verificado = true, referencia_pago = v_ocr_referencia, updated_at = NOW() 
                        WHERE id = v_pedido.id
                        RETURNING * INTO v_pedido;
                    ELSE
                        -- Actualizar Pedido a verificado normalmente
                        UPDATE public.pedidos 
                        SET pago_verificado = true, updated_at = NOW() 
                        WHERE id = v_pedido.id
                        RETURNING * INTO v_pedido;
                    END IF;
                    
                    -- Marcar pago APK como usado
                    UPDATE public.pagos_apk
                    SET status = 'usado', pedido_id = v_pedido.id, usuario_id = v_user_id
                    WHERE id = v_apk_pago.id;
                END IF;
            END IF;
        END;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        INSERT INTO public.pedido_items (
            pedido_id, producto_id, juego_nombre, producto_nombre, cantidad, precio_usd, precio_bs,
            metodo_recarga, player_id, zone_id, nickname, account_email, account_user, account_password, producto_icono
        ) VALUES (
            v_pedido_id, (v_item->>'producto_id')::INT, v_item->>'juego_nombre', v_item->>'producto_nombre',
            (v_item->>'cantidad')::INT, (v_item->>'precio_usd')::NUMERIC, (v_item->>'precio_bs')::NUMERIC,
            v_item->>'metodo_recarga', v_item->>'player_id', v_item->>'zone_id', v_item->>'nickname',
            v_item->>'account_email', v_item->>'account_user', v_item->>'account_password', v_item->>'producto_icono'
        );
    END LOOP;

    IF p_wallet_usd_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (v_user_id, -p_wallet_usd_deduct, 'pago_pedido', 'Pago Billetera - Pedido #' || v_pedido.numero_pedido::TEXT, v_pedido_id::TEXT, 'usd');
    END IF;

    IF p_wallet_bs_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (v_user_id, -p_wallet_bs_deduct, 'pago_pedido', 'Pago Billetera Bs - Pedido #' || v_pedido.numero_pedido::TEXT, v_pedido_id::TEXT, 'bs');
    END IF;

    RETURN json_build_object('success', true, 'pedido', row_to_json(v_pedido));
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
