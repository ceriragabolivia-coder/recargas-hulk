-- Migration: 051_reembolso_unico.sql
-- Description: Evitar multiples reembolsos de billetera por pedido

-- Add column to track if a refund has been issued
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS reembolso_billetera BOOLEAN DEFAULT false;

-- Update the refund RPC
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
    SELECT id, cliente_id, total_bs, total_usd, estado, reembolso_billetera
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- Prevenir doble reembolso forzoso
    IF v_pedido.reembolso_billetera = true THEN
        RETURN jsonb_build_object('error', 'Este pedido ya recibió una devolución de fondos a la billetera. No se pueden hacer devoluciones múltiples.');
    END IF;

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

    -- 5. Log the transaction (ahora especificando el p_pedido_id en la referencia)
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        v_pedido.cliente_id,
        v_refund_amount,
        'reembolso',
        COALESCE(p_notas, 'Reembolso parcial/total del pedido #' || v_pedido.id::TEXT),
        p_pedido_id,
        p_moneda
    );

    -- 6. Update order status and set reembolso_billetera flag
    IF p_cambiar_estado THEN
        UPDATE public.pedidos
        SET estado = 'reembolsado',
            atendido_por_id = p_admin_id,
            fecha_respuesta = now(),
            reembolso_billetera = true,
            updated_at = now()
        WHERE id = p_pedido_id;
    ELSE
        UPDATE public.pedidos
        SET reembolso_billetera = true,
            updated_at = now()
        WHERE id = p_pedido_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
