-- 094_wallet_security_and_responsive.sql
-- Fix for wallet balance deduction and transaction consistency

-- 1. Change referencia_id to TEXT in billetera_transacciones to support both UUID and INT
ALTER TABLE public.billetera_transacciones 
ALTER COLUMN referencia_id TYPE TEXT;

-- 2. Update pagar_con_billetera_rpc with security and correct casting
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id ANYELEMENT, -- Allow any type (INT or UUID)
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- SEGURIDAD: Solo el dueño de la billetera puede pagar
    IF NOT (auth.uid() = p_user_id) THEN
        RAISE EXCEPTION 'No puedes pagar con la billetera de otro usuario.';
    END IF;

    -- 1. Fetch current balance with lock
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- 2. Deduct amount
    UPDATE public.billeteras
    SET saldo = saldo - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- 3. Log Transaction (Casting pedido_id to TEXT)
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id::TEXT, 'usd');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update pagar_con_billetera_bs_rpc with security and correct casting
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id ANYELEMENT, -- Allow any type (INT or UUID)
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- SEGURIDAD: Solo el dueño de la billetera puede pagar
    IF NOT (auth.uid() = p_user_id) THEN
        RAISE EXCEPTION 'No puedes pagar con la billetera de otro usuario.';
    END IF;

    -- 1. Fetch current balance with lock
    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- 2. Deduct amount
    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- 3. Log Transaction (Casting pedido_id to TEXT)
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id::TEXT, 'bs');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';
