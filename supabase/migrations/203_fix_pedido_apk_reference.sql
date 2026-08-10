-- Migration: 203_fix_pedido_apk_reference.sql
-- Description: Actualiza crear_pedido_seguro_rpc para verificar atómicamente la referencia de pago en la tabla pagos_apk. Esto previene la reutilización de referencias si el pago llegó antes de crear el pedido.

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
        BEGIN
            SELECT * INTO v_apk_pago 
            FROM public.pagos_apk 
            WHERE (referencia = v_pedido.referencia_pago OR referencia LIKE v_pedido.referencia_pago || ' |%')
            AND status = 'disponible'
            LIMIT 1;

            IF FOUND THEN
                v_amount_to_check := COALESCE(v_pedido.monto_restante_bs, v_pedido.total_bs);
                IF ABS(v_apk_pago.monto - v_amount_to_check) <= 0.05 THEN
                    -- Actualizar Pedido a verificado
                    UPDATE public.pedidos 
                    SET pago_verificado = true, updated_at = NOW() 
                    WHERE id = v_pedido.id
                    RETURNING * INTO v_pedido;
                    
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
