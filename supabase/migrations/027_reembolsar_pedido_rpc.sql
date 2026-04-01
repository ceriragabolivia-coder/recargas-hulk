-- Migration: 027_reembolsar_pedido_rpc.sql
-- Description: RPC function to refund an order back to the client's wallet

CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
BEGIN
    -- 1. Fetch the order and validate
    SELECT id, cliente_id, total_bs, total_usd, estado
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- 2. Prevent double refund
    IF v_pedido.estado = 'reembolsado' THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 3. Ensure the client has a wallet, create one if not
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo)
        VALUES (v_pedido.cliente_id, 0);
    END IF;

    -- 4. Credit the refund amount (in USD) to the client's wallet
    UPDATE public.billeteras
    SET saldo = saldo + v_pedido.total_usd,
        updated_at = now()
    WHERE auth_user_id = v_pedido.cliente_id;

    -- 5. Log the transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (
        v_pedido.cliente_id,
        v_pedido.total_usd,
        'reembolso',
        COALESCE(p_notas, 'Reembolso de pedido #' || v_pedido.id::TEXT),
        NULL  -- referencia_id is UUID, pedido id is INT so we skip
    );

    -- 6. Update the order status
    UPDATE public.pedidos
    SET estado = 'reembolsado',
        atendido_por_id = p_admin_id,
        fecha_respuesta = now(),
        updated_at = now()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_pedido.total_usd);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache so PostgREST picks up the new function
NOTIFY pgrst, 'reload schema';
