-- Migración 177: Rescatar ventas no registradas por fallos silenciosos

CREATE OR REPLACE FUNCTION public.backfill_ventas_perdidas()
RETURNS JSON AS $$
DECLARE
    v_pedido RECORD;
    v_item RECORD;
    v_superadmin_id UUID;
    v_ventas_insertadas INT := 0;
    v_errores JSONB := '[]'::JSONB;
    v_resultado JSON;
BEGIN
    SELECT c.id INTO v_superadmin_id 
    FROM public.clientes c
    JOIN auth.users u ON u.id = c.auth_user_id
    WHERE LOWER(u.email) = 'recargashulk@gmail.com' LIMIT 1;
    
    IF v_superadmin_id IS NULL THEN
        SELECT c.id INTO v_superadmin_id 
        FROM public.clientes c
        WHERE LOWER(c.usuario) = 'recargashulk@gmail.com' LIMIT 1;
    END IF;

    FOR v_pedido IN 
        SELECT p.* 
        FROM public.pedidos p
        WHERE p.estado = 'completado'
          AND NOT EXISTS (
              SELECT 1 FROM public.ventas v 
              WHERE v.notas = 'Auto-proceso Pedido #' || COALESCE(p.numero_pedido::TEXT, p.id::TEXT)
                 OR v.pedido_id::text = p.id::text
          )
    LOOP
        FOR v_item IN SELECT * FROM public.pedido_items WHERE pedido_id = v_pedido.id LOOP
            
            v_resultado := public.registrar_venta_rpc(
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
                NULL,
                v_pedido.owner_id
            );
            
            IF v_resultado->>'error' IS NOT NULL THEN
                v_errores := v_errores || jsonb_build_object('pedido', COALESCE(v_pedido.numero_pedido::TEXT, v_pedido.id::TEXT), 'error', v_resultado->>'error');
            ELSE
                v_ventas_insertadas := v_ventas_insertadas + 1;
            END IF;

        END LOOP;
    END LOOP;
    
    RETURN json_build_object('ventas_recuperadas', v_ventas_insertadas, 'errores', v_errores);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
