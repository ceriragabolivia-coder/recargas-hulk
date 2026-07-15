CREATE OR REPLACE FUNCTION public.test_backfill_hendrick()
RETURNS JSON AS $$
DECLARE
    v_item RECORD;
    v_pedido RECORD;
    v_venta JSON;
    v_superadmin_id UUID;
BEGIN
    SELECT * INTO v_pedido FROM public.pedidos WHERE numero_pedido = 156 LIMIT 1;
    
    SELECT c.id INTO v_superadmin_id 
    FROM public.clientes c
    JOIN auth.users u ON u.id = c.auth_user_id
    WHERE LOWER(u.email) = 'recargashulk@gmail.com' LIMIT 1;
    
    IF v_superadmin_id IS NULL THEN
        SELECT c.id INTO v_superadmin_id 
        FROM public.clientes c
        WHERE LOWER(c.usuario) = 'recargashulk@gmail.com' LIMIT 1;
    END IF;

    SELECT * INTO v_item FROM public.pedido_items WHERE pedido_id = v_pedido.id LIMIT 1;

    v_venta := public.registrar_venta_rpc(
        v_item.producto_id,
        v_item.cantidad,
        'Auto-proceso Pedido #' || COALESCE(v_pedido.numero_pedido::TEXT, v_pedido.id::TEXT),
        v_pedido.cliente_id,
        v_superadmin_id,
        v_pedido.metodo_pago_id,
        v_pedido.referencia_pago,
        v_item.player_id,
        v_item.account_email,
        v_item.account_password,
        NULL, -- p_pedido_id UUID
        v_pedido.owner_id
    );

    RETURN v_venta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.test_backfill_hendrick() TO anon;
NOTIFY pgrst, 'reload schema';
