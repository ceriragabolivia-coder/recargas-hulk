CREATE OR REPLACE FUNCTION public.test_auto_522()
RETURNS JSON AS $$
DECLARE
    v_pedido_id UUID;
    v_res JSON;
BEGIN
    SELECT id INTO v_pedido_id FROM public.pedidos WHERE numero_pedido = 522;
    IF v_pedido_id IS NULL THEN
        RETURN json_build_object('error', 'pedido 522 no encontrado');
    END IF;

    -- Return the status of the order before testing
    SELECT json_build_object('estado', estado, 'pago_verificado', pago_verificado) INTO v_res FROM public.pedidos WHERE id = v_pedido_id;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
