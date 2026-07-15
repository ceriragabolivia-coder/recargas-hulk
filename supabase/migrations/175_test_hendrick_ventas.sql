CREATE OR REPLACE FUNCTION public.get_test_hendrick_ventas()
RETURNS JSON AS $$
DECLARE
    v_cliente_id UUID;
    v_result JSON;
BEGIN
    SELECT id INTO v_cliente_id FROM public.clientes WHERE whatsapp = '+584122920612' LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RETURN json_build_object('error', 'Cliente no encontrado');
    END IF;

    SELECT json_agg(json_build_object(
        'id', v.id,
        'created_at', v.created_at,
        'ganancia_usd', v.ganancia_usd,
        'pedido_id', v.pedido_id,
        'notas', v.notas,
        'cliente_id', v.cliente_id
    )) INTO v_result
    FROM public.ventas v
    WHERE v.cliente_id = v_cliente_id;

    RETURN json_build_object('cliente_id', v_cliente_id, 'ventas', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
