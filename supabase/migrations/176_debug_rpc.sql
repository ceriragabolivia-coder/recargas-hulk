CREATE OR REPLACE FUNCTION public.get_debug_hendrick()
RETURNS JSON AS $$
DECLARE
    v_cliente_id UUID;
    v_result JSON;
BEGIN
    SELECT id INTO v_cliente_id FROM public.clientes WHERE whatsapp = '+584122920612' LIMIT 1;
    
    SELECT json_agg(json_build_object(
        'id', v.id,
        'ganancia_usd', v.ganancia_usd,
        'created_at', v.created_at,
        'pedido_id', v.pedido_id,
        'vendedor_id', v.vendedor_id
    )) INTO v_result 
    FROM public.ventas v 
    WHERE cliente_id = v_cliente_id;
    
    RETURN json_build_object('cliente_id', v_cliente_id, 'ventas', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_debug_hendrick() TO anon;

NOTIFY pgrst, 'reload schema';
