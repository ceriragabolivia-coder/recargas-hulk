-- 097_wallet_security_enforcement.sql
-- Massive fix for wallet security and atomic transactions

-- 1. Add constraints to prevent negative amounts and ensure consistency
ALTER TABLE public.billeteras ADD CONSTRAINT positive_balance CHECK (saldo >= 0);
ALTER TABLE public.billeteras ADD CONSTRAINT positive_balance_bs CHECK (saldo_bs >= 0);

-- 2. Drop old wallet RPCs first (needed to change return type from BOOLEAN to JSON)
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, anyelement, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, anyelement, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, uuid, text);

-- 3. Update pagar_con_billetera_rpc to be more strict and return JSON for better error handling
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID, -- Force UUID for landing orders
    p_description TEXT
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_pedido_exists BOOLEAN;
BEGIN
    -- 0. Validar monto
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero.');
    END IF;

    -- 1. SEGURIDAD: Solo el dueño de la billetera puede pagar
    IF NOT (auth.uid() = p_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado.');
    END IF;

    -- 2. Verificar existencia del pedido
    SELECT EXISTS(SELECT 1 FROM public.pedidos WHERE id = p_pedido_id) INTO v_pedido_exists;
    IF NOT v_pedido_exists THEN
        RETURN json_build_object('success', false, 'message', 'El pedido no existe.');
    END IF;

    -- 3. Fetch current balance with lock
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'message', 'Saldo insuficiente (Saldo: ' || COALESCE(v_current_balance, 0) || ', Requerido: ' || p_amount || ')');
    END IF;

    -- 4. Deduct amount
    UPDATE public.billeteras
    SET saldo = saldo - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- 5. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id::TEXT, 'usd');

    -- 6. Mark pedido as paid automatically if it's a wallet-only or marked as such
    -- (Optional: based on your business logic)
    
    RETURN json_build_object('success', true, 'new_balance', v_current_balance - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Same for Bs
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_pedido_exists BOOLEAN;
BEGIN
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero.');
    END IF;

    IF NOT (auth.uid() = p_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado.');
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.pedidos WHERE id = p_pedido_id) INTO v_pedido_exists;
    IF NOT v_pedido_exists THEN
        RETURN json_build_object('success', false, 'message', 'El pedido no existe.');
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
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id::TEXT, 'bs');

    RETURN json_build_object('success', true, 'new_balance', v_current_balance - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';
