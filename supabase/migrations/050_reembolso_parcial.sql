-- Migration: 050_reembolso_parcial.sql
-- Description: Actualizar reembolsar_pedido_rpc para aceptar montos parciales y opción de cambiar estado

CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd',
    p_monto NUMERIC DEFAULT NULL,
    p_cambiar_estado BOOLEAN DEFAULT true
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

    -- Solo prevenir si es un reembolso automático sin monto definido
    IF v_pedido.estado = 'reembolsado' AND p_monto IS NULL THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 2. Determine refund amount based on currency
    IF p_monto IS NOT NULL THEN
        v_refund_amount := p_monto;
    ELSIF p_moneda = 'bs' THEN
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
        COALESCE(p_notas, 'Reembolso parcial/total del pedido #' || v_pedido.id::TEXT),
        NULL,
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
