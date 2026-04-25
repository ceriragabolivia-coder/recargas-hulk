-- Migration: 065_fix_pedido_id_type_consistency.sql
-- Description: Fix functions that were using UUID for p_pedido_id when the table uses INT (SERIAL).

-- 1. Fix reembolsar_pedido_rpc
DROP FUNCTION IF EXISTS public.reembolsar_pedido_rpc(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd',
    p_monto NUMERIC DEFAULT NULL,
    p_cambiar_estado BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
    v_refund_amount NUMERIC;
BEGIN
    -- 1. Fetch the order
    SELECT id, cliente_id, total_bs, total_usd, estado
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- 2. Determine refund amount
    v_refund_amount := COALESCE(p_monto, CASE WHEN p_moneda = 'bs' THEN v_pedido.total_bs ELSE v_pedido.total_usd END);

    -- 3. Ensure wallet exists
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_pedido.cliente_id, 0, 0);
    END IF;

    -- 4. Credit the appropriate wallet
    IF p_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = saldo_bs + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = saldo + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    END IF;

    -- 5. Log the transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        v_pedido.cliente_id,
        v_refund_amount,
        'reembolso',
        COALESCE(p_notas, 'Reembolso de pedido #' || v_pedido.id::TEXT),
        NULL, -- referencia_id is UUID, pedido id is INT
        p_moneda
    );

    -- 6. Update order status if requested
    IF p_cambiar_estado THEN
        UPDATE public.pedidos
        SET estado = 'reembolsado',
            atendido_por_id = p_admin_id,
            fecha_respuesta = now(),
            updated_at = now()
        WHERE id = p_pedido_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix pagar_con_billetera_rpc
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, uuid, text);
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
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

    -- 3. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, NULL); -- referencia_id is UUID, pedido id is INT

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix pagar_con_billetera_bs_rpc
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, uuid, text);
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, NULL, 'bs');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
