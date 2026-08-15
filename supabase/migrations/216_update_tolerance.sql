-- Migration: 216_update_tolerance.sql
-- Description: Update tolerance for auto-validation of payments to 2.0 Bs to account for rounding errors or small user mistakes

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
BEGIN
    -- Limpiar la referencia
    p_referencia := TRIM(p_referencia);

    -- 1. Buscar en pagos_apk un pago disponible que coincida en referencia
    SELECT * INTO v_apk_pago 
    FROM public.pagos_apk 
    WHERE referencia = p_referencia 
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

    -- 5. Aprobar la recarga
    UPDATE public.billetera_recargas
    SET estado = 'aprobado', updated_at = NOW()
    WHERE id = p_recarga_id;

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
    
    v_calculated_total_usd NUMERIC := 0;
    v_calculated_total_bs NUMERIC := 0;
    v_precio_db RECORD;
    v_cantidad INT;
    v_precio_frontend NUMERIC;
    v_cupon_descuento_usd NUMERIC := 0;
    v_cupon_descuento_bs NUMERIC := 0;
BEGIN
    -- Extract user ID from the pedido data
    v_user_id := (p_pedido_data->>'cliente_id')::UUID;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'cliente_id es requerido');
    END IF;

    -- SECURITY: Verify the executing user is the owner of the order
    IF auth.uid() != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado para crear pedidos a nombre de otro usuario');
    END IF;

    -- 2.1 CÁLCULO SEGURO DEL PRECIO TOTAL BASADO EN LA BASE DE DATOS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        v_cantidad := (v_item->>'cantidad')::INT;
        v_precio_frontend := (v_item->>'precio_usd')::NUMERIC;
        
        -- Obtener el COSTO BASE de la base de datos
        SELECT costo_base INTO v_precio_db
        FROM public.productos
        WHERE id = (v_item->>'producto_id')::INT;
        
        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Producto no encontrado en la base de datos: ' || (v_item->>'producto_id'));
        END IF;
        
        -- SEGURIDAD: Verificar que el precio enviado por el frontend NO sea menor que el costo base de la tienda.
        IF v_precio_frontend < (v_precio_db.costo_base - 0.05) THEN
            RETURN json_build_object('success', false, 'message', 'Intento de manipulación de precio detectado o precio demasiado bajo para producto ' || (v_item->>'producto_id'));
        END IF;
        
        -- Acumular el total real
        v_calculated_total_usd := v_calculated_total_usd + (v_precio_frontend * v_cantidad);
    END LOOP;
    
    -- Aplicar cupones de descuento
    v_cupon_descuento_usd := COALESCE((p_pedido_data->>'descuento_cupon_usd')::NUMERIC, 0);
    v_cupon_descuento_bs := COALESCE((p_pedido_data->>'descuento_cupon_bs')::NUMERIC, 0);
    
    v_calculated_total_usd := GREATEST(0, v_calculated_total_usd - v_cupon_descuento_usd);
    
    -- Si el frontend intentó usar más saldo del necesario, lo ajustamos al total real calculado
    IF p_wallet_usd_deduct > v_calculated_total_usd THEN
        p_wallet_usd_deduct := v_calculated_total_usd;
    END IF;
    
    v_calculated_total_bs := (p_pedido_data->>'total_bs')::NUMERIC;

    -- 1. LOCK WALLET AND DEDUCT BALANCES (ATOMIC)
    IF p_wallet_usd_deduct > 0 OR p_wallet_bs_deduct > 0 THEN
        -- Lock the row to prevent race conditions
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

        -- Perform Deductions
        UPDATE public.billeteras
        SET 
            saldo = saldo - p_wallet_usd_deduct,
            saldo_bs = saldo_bs - p_wallet_bs_deduct,
            updated_at = NOW()
        WHERE auth_user_id = v_user_id;
    END IF;

    -- 2. CREATE OR UPDATE THE ORDER (PEDIDO)
    IF p_existing_pedido_id IS NOT NULL THEN
        -- Update existing
        UPDATE public.pedidos
        SET 
            metodo_pago_id = (p_pedido_data->>'metodo_pago_id')::UUID,
            referencia_pago = p_pedido_data->>'referencia_pago',
            total_usd = v_calculated_total_usd,
            total_bs = v_calculated_total_bs,
            estado = p_pedido_data->>'estado',
            comprobante_url = p_pedido_data->>'comprobante_url',
            pago_verificado = ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            cupon_id = (p_pedido_data->>'cupon_id')::UUID,
            descuento_cupon_usd = v_cupon_descuento_usd,
            descuento_cupon_bs = v_cupon_descuento_bs,
            monto_restante_bs = COALESCE((p_pedido_data->>'monto_restante_bs')::NUMERIC, v_calculated_total_bs),
            updated_at = NOW()
        WHERE id = p_existing_pedido_id AND cliente_id = v_user_id
        RETURNING * INTO v_pedido;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Pedido existente no encontrado o no autorizado');
        END IF;
        
        v_pedido_id := v_pedido.id;

        -- Delete old items
        DELETE FROM public.pedido_items WHERE pedido_id = v_pedido_id;
    ELSE
        -- Insert new
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
            v_calculated_total_usd,
            v_calculated_total_bs,
            p_pedido_data->>'estado',
            p_pedido_data->>'comprobante_url',
            ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            (p_pedido_data->>'cupon_id')::UUID,
            v_cupon_descuento_usd,
            v_cupon_descuento_bs,
            COALESCE((p_pedido_data->>'monto_restante_bs')::NUMERIC, v_calculated_total_bs)
        ) RETURNING * INTO v_pedido;

        v_pedido_id := v_pedido.id;
    END IF;

    -- LÓGICA: Auto-verificar atómicamente contra pagos_apk si la referencia ya llegó
    IF v_pedido.pago_verificado IS NOT TRUE AND v_pedido.referencia_pago != 'N/A' AND v_pedido.referencia_pago NOT LIKE 'PAGO_BILLETERA%' THEN
        DECLARE
            v_apk_pago RECORD;
            v_amount_to_check NUMERIC;
            v_ocr_referencia TEXT;
            v_suffix TEXT := '';
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
                -- USANDO TOLERANCIA DE 2.0 Bs EN LUGAR DE 0.05
                IF ABS(v_apk_pago.monto - v_amount_to_check) <= 2.0 THEN
                    -- Si el APK coincidió por ocr_referencia, actualizamos la referencia_pago real en el pedido
                    IF (v_ocr_referencia IS NOT NULL AND (v_apk_pago.referencia = v_ocr_referencia OR v_apk_pago.referencia LIKE v_ocr_referencia || ' |%')) AND v_apk_pago.referencia != v_pedido.referencia_pago THEN
                        -- Preservar el sufijo de pago parcial si existe
                        IF v_pedido.referencia_pago LIKE '% | Pago Parcial%' THEN
                            v_suffix := SUBSTRING(v_pedido.referencia_pago FROM POSITION(' | Pago Parcial' IN v_pedido.referencia_pago));
                        END IF;
                        
                        UPDATE public.pedidos 
                        SET pago_verificado = true, referencia_pago = v_ocr_referencia || v_suffix, updated_at = NOW() 
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

    -- 3. INSERT NEW ITEMS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        INSERT INTO public.pedido_items (
            pedido_id,
            producto_id,
            juego_nombre,
            producto_nombre,
            cantidad,
            precio_usd,
            precio_bs,
            metodo_recarga,
            player_id,
            zone_id,
            nickname,
            account_email,
            account_user,
            account_password,
            producto_icono
        ) VALUES (
            v_pedido_id,
            (v_item->>'producto_id')::INT,
            v_item->>'juego_nombre',
            v_item->>'producto_nombre',
            (v_item->>'cantidad')::INT,
            (v_item->>'precio_usd')::NUMERIC,
            (v_item->>'precio_bs')::NUMERIC,
            v_item->>'metodo_recarga',
            v_item->>'player_id',
            v_item->>'zone_id',
            v_item->>'nickname',
            v_item->>'account_email',
            v_item->>'account_user',
            v_item->>'account_password',
            v_item->>'producto_icono'
        );
    END LOOP;

    -- 4. LOG TRANSACTIONS IN BILLETERA_TRANSACCIONES
    IF p_wallet_usd_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (
            v_user_id, 
            -p_wallet_usd_deduct, 
            'pago_pedido', 
            'Pago Billetera - Pedido #' || v_pedido.numero_pedido::TEXT, 
            v_pedido_id::TEXT, 
            'usd'
        );
    END IF;

    IF p_wallet_bs_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (
            v_user_id, 
            -p_wallet_bs_deduct, 
            'pago_pedido', 
            'Pago Billetera Bs - Pedido #' || v_pedido.numero_pedido::TEXT, 
            v_pedido_id::TEXT, 
            'bs'
        );
    END IF;

    -- If we get here, everything succeeded.
    RETURN json_build_object('success', true, 'pedido', row_to_json(v_pedido));
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
