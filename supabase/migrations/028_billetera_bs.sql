-- Migration: 028_billetera_bs.sql
-- Description: Add Bolívares (Bs) wallet support alongside existing USD wallet

-- =========================================================
-- 1. Add saldo_bs column to billeteras
-- =========================================================
ALTER TABLE public.billeteras
ADD COLUMN IF NOT EXISTS saldo_bs NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- =========================================================
-- 2. Add moneda column to billetera_recargas
-- =========================================================
ALTER TABLE public.billetera_recargas
ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'usd'
CHECK (moneda IN ('usd', 'bs'));

-- =========================================================
-- 3. Add moneda column to billetera_transacciones
-- =========================================================
ALTER TABLE public.billetera_transacciones
ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'usd'
CHECK (moneda IN ('usd', 'bs'));

-- =========================================================
-- 3b. Add visibility columns to metodos_pago
-- =========================================================
ALTER TABLE public.metodos_pago
ADD COLUMN IF NOT EXISTS habilitado_billetera BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS habilitado_billetera_bs BOOLEAN DEFAULT false;

-- =========================================================
-- 4. Update aprobar_recarga_rpc to support currency
-- =========================================================
CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_moneda TEXT;
BEGIN
    -- 1. Check if recharge is pending
    SELECT auth_user_id, monto, COALESCE(moneda, 'usd')
    INTO v_user_id, v_amount, v_moneda
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Mark as approved
    UPDATE public.billetera_recargas
    SET estado = 'aprobado',
        atendido_por_id = p_admin_id,
        notas_admin = p_notas,
        updated_at = now()
    WHERE id = p_recarga_id;

    -- 3. Update or Insert wallet balance based on currency
    IF v_moneda = 'bs' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_user_id, 0, v_amount)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + v_amount, updated_at = now();
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo)
        VALUES (v_user_id, v_amount)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo = public.billeteras.saldo + v_amount, updated_at = now();
    END IF;

    -- 4. Log Transaction with currency
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (v_user_id, v_amount, 'recarga', 'Recarga de billetera aprobada', p_recarga_id, v_moneda);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 5. Update reembolsar_pedido_rpc with p_moneda parameter
-- =========================================================
CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd'
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

    IF v_pedido.estado = 'reembolsado' THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 2. Determine refund amount based on currency
    IF p_moneda = 'bs' THEN
        v_refund_amount := ROUND(v_pedido.total_bs);
    ELSE
        v_refund_amount := v_pedido.total_usd;
    END IF;

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
        NULL,
        p_moneda
    );

    -- 6. Update order status
    UPDATE public.pedidos
    SET estado = 'reembolsado',
        atendido_por_id = p_admin_id,
        fecha_respuesta = now(),
        updated_at = now()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 6. Create pagar_con_billetera_bs_rpc for Bs payments
-- =========================================================
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
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id, 'bs');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 7. Create ajustar_saldo_billetera_bs_rpc for admin adjustments
-- =========================================================
CREATE OR REPLACE FUNCTION public.ajustar_saldo_billetera_bs_rpc(
    p_user_id UUID,
    p_admin_id UUID,
    p_nuevo_saldo NUMERIC,
    p_nota TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_balance NUMERIC;
    v_diff NUMERIC;
BEGIN
    -- Ensure wallet exists
    INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (auth_user_id) DO NOTHING;

    SELECT saldo_bs INTO v_old_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    v_diff := p_nuevo_saldo - COALESCE(v_old_balance, 0);

    UPDATE public.billeteras
    SET saldo_bs = p_nuevo_saldo, updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        p_user_id,
        v_diff,
        'ajuste_admin',
        COALESCE(p_nota, 'Ajuste administrativo de saldo Bs'),
        NULL,
        'bs'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 8. Update revertir_recarga_rpc to handle currency
-- =========================================================
CREATE OR REPLACE FUNCTION public.revertir_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_moneda TEXT;
BEGIN
    SELECT auth_user_id, monto, COALESCE(moneda, 'usd')
    INTO v_user_id, v_amount, v_moneda
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'aprobado';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Mark as reverted
    UPDATE public.billetera_recargas
    SET estado = 'rechazado',
        notas_admin = 'Revertido por administrador',
        atendido_por_id = p_admin_id,
        updated_at = now()
    WHERE id = p_recarga_id;

    -- Deduct from appropriate balance
    IF v_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = GREATEST(saldo_bs - v_amount, 0), updated_at = now()
        WHERE auth_user_id = v_user_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = GREATEST(saldo - v_amount, 0), updated_at = now()
        WHERE auth_user_id = v_user_id;
    END IF;

    -- Log reversal
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (v_user_id, -v_amount, 'ajuste_admin', 'Reversión de recarga', p_recarga_id, v_moneda);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
