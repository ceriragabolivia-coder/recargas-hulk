-- 173_billetera_link_pedido.sql

-- 1. Modificar pagar_con_billetera_rpc para devolver el transaccion_id
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id INT,
    p_description TEXT
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_pedido_exists BOOLEAN;
    v_transaccion_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero.');
    END IF;

    IF NOT (auth.uid() = p_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado.');
    END IF;

    IF p_pedido_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.pedidos WHERE id = p_pedido_id) INTO v_pedido_exists;
        IF NOT v_pedido_exists THEN
            RETURN json_build_object('success', false, 'message', 'El pedido #' || p_pedido_id || ' no existe.');
        END IF;
    END IF;

    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'message', 'Saldo insuficiente.');
    END IF;

    UPDATE public.billeteras
    SET saldo = saldo - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id::TEXT, 'usd')
    RETURNING id INTO v_transaccion_id;

    RETURN json_build_object('success', true, 'new_balance', v_current_balance - p_amount, 'transaccion_id', v_transaccion_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Modificar pagar_con_billetera_bs_rpc para devolver el transaccion_id
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id INT,
    p_description TEXT
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_pedido_exists BOOLEAN;
    v_transaccion_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero.');
    END IF;

    IF NOT (auth.uid() = p_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado.');
    END IF;

    IF p_pedido_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.pedidos WHERE id = p_pedido_id) INTO v_pedido_exists;
        IF NOT v_pedido_exists THEN
            RETURN json_build_object('success', false, 'message', 'El pedido #' || p_pedido_id || ' no existe.');
        END IF;
    END IF;

    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'message', 'Saldo insuficiente en Bs.');
    END IF;

    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id::TEXT, 'bs')
    RETURNING id INTO v_transaccion_id;

    RETURN json_build_object('success', true, 'new_balance', v_current_balance - p_amount, 'transaccion_id', v_transaccion_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear RPC para vincular transaccion a pedido
CREATE OR REPLACE FUNCTION public.vincular_transaccion_pedido_rpc(
    p_transaccion_id UUID,
    p_pedido_id INT,
    p_numero_pedido INT
) RETURNS VOID AS $$
BEGIN
    UPDATE public.billetera_transacciones
    SET referencia_id = p_pedido_id::TEXT,
        descripcion = 'Pago Pedido #' || p_numero_pedido::TEXT
    WHERE id = p_transaccion_id
      AND auth_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
