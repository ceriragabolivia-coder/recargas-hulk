-- Migration: 197_crear_pedido_seguro_rpc.sql
-- Description: RPC for atomic order creation and wallet deduction to prevent double spending race conditions.

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
    -- Extract user ID from the pedido data
    v_user_id := (p_pedido_data->>'cliente_id')::UUID;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'cliente_id es requerido');
    END IF;

    -- SECURITY: Verify the executing user is the owner of the order
    IF auth.uid() != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado para crear pedidos a nombre de otro usuario');
    END IF;

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

        -- Verify USD Balance
        IF p_wallet_usd_deduct > 0 THEN
            IF v_current_balance_usd IS NULL OR v_current_balance_usd < p_wallet_usd_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo USD insuficiente en la billetera');
            END IF;
        END IF;

        -- Verify BS Balance
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
            total_usd = (p_pedido_data->>'total_usd')::NUMERIC,
            total_bs = (p_pedido_data->>'total_bs')::NUMERIC,
            estado = p_pedido_data->>'estado',
            comprobante_url = p_pedido_data->>'comprobante_url',
            pago_verificado = ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            cupon_id = (p_pedido_data->>'cupon_id')::UUID,
            descuento_cupon_usd = (p_pedido_data->>'descuento_cupon_usd')::NUMERIC,
            descuento_cupon_bs = (p_pedido_data->>'descuento_cupon_bs')::NUMERIC,
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
            descuento_cupon_bs
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
            (p_pedido_data->>'descuento_cupon_bs')::NUMERIC
        ) RETURNING * INTO v_pedido;

        v_pedido_id := v_pedido.id;
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

    -- If we get here, everything succeeded. The transaction will automatically commit.
    RETURN json_build_object('success', true, 'pedido', row_to_json(v_pedido));
EXCEPTION WHEN OTHERS THEN
    -- If any error occurs, postgres will rollback the transaction automatically
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
