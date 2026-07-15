CREATE OR REPLACE FUNCTION public.get_ganancias_test_rpc()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(json_build_object(
        'pedido_id', v.pedido_id,
        'ganancia_usd', v.ganancia_usd,
        'vendedor_id', v.vendedor_id,
        'precio_venta_usd', v.precio_venta_usd,
        'costo_base_momento', v.costo_base_momento
    )) INTO v_result
    FROM public.ventas v
    WHERE v.ganancia_usd = 0
    LIMIT 20;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
