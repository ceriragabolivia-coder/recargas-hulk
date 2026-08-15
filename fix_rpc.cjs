const { Client } = require('ssh2');

const sqlContent = `
CREATE OR REPLACE FUNCTION public.crear_pedido_seguro_rpc(
    p_pedido_data JSONB,
    p_items_data JSONB,
    p_wallet_usd_deduct NUMERIC DEFAULT 0,
    p_wallet_bs_deduct NUMERIC DEFAULT 0,
    p_existing_pedido_id INT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_current_balance_usd NUMERIC;
    v_current_balance_bs NUMERIC;
    v_pedido_id INT;
    v_pedido RECORD;
    v_item JSONB;
    
    v_calculated_total_usd NUMERIC := 0;
    v_calculated_total_bs NUMERIC := 0;
    v_precio_db RECORD;
    v_cantidad INT;
    v_precio_frontend NUMERIC;
    v_cupon_descuento_usd NUMERIC := 0;
    v_cupon_descuento_bs NUMERIC := 0;
BEGIN
    v_user_id := (p_pedido_data->>'cliente_id')::UUID;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'cliente_id es requerido');
    END IF;

    IF auth.uid() != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado');
    END IF;

    -- VALIDATE PRICES AGAINST BASE COST
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        v_cantidad := (v_item->>'cantidad')::INT;
        v_precio_frontend := (v_item->>'precio_usd')::NUMERIC;
        
        SELECT costo_base INTO v_precio_db
        FROM public.productos
        WHERE id = (v_item->>'producto_id')::INT;
        
        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Producto no encontrado');
        END IF;
        
        -- Verificar que el precio frontend no sea menor que el costo base (con un pequeno margen por redondeo)
        IF v_precio_frontend < (v_precio_db.costo_base - 0.05) THEN
            RETURN json_build_object('success', false, 'message', 'Intento de manipulacion de precio detectado.');
        END IF;
        
        v_calculated_total_usd := v_calculated_total_usd + (v_precio_frontend * v_cantidad);
    END LOOP;
    
    v_cupon_descuento_usd := COALESCE((p_pedido_data->>'descuento_cupon_usd')::NUMERIC, 0);
    v_cupon_descuento_bs := COALESCE((p_pedido_data->>'descuento_cupon_bs')::NUMERIC, 0);
    
    v_calculated_total_usd := GREATEST(0, v_calculated_total_usd - v_cupon_descuento_usd);
    
    IF p_wallet_usd_deduct > v_calculated_total_usd THEN
        p_wallet_usd_deduct := v_calculated_total_usd;
    END IF;
    
    v_calculated_total_bs := (p_pedido_data->>'total_bs')::NUMERIC;

    IF p_wallet_usd_deduct > 0 OR p_wallet_bs_deduct > 0 THEN
        SELECT saldo, saldo_bs INTO v_current_balance_usd, v_current_balance_bs
        FROM public.billeteras
        WHERE auth_user_id = v_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Billetera no encontrada');
        END IF;

        IF p_wallet_usd_deduct > 0 THEN
            IF v_current_balance_usd IS NULL OR v_current_balance_usd < p_wallet_usd_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo USD insuficiente');
            END IF;
        END IF;

        IF p_wallet_bs_deduct > 0 THEN
            IF v_current_balance_bs IS NULL OR v_current_balance_bs < p_wallet_bs_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo Bs insuficiente');
            END IF;
        END IF;

        UPDATE public.billeteras
        SET 
            saldo = saldo - p_wallet_usd_deduct,
            saldo_bs = saldo_bs - p_wallet_bs_deduct,
            updated_at = NOW()
        WHERE auth_user_id = v_user_id;
    END IF;

    IF p_existing_pedido_id IS NOT NULL THEN
        UPDATE public.pedidos
        SET 
            metodo_pago_id = (p_pedido_data->>'metodo_pago_id')::UUID,
            referencia_pago = p_pedido_data->>'referencia_pago',
            total_usd = v_calculated_total_usd,
            total_bs = v_calculated_total_bs,
            estado = p_pedido_data->>'estado',
            comprobante_url = p_pedido_data->>'comprobante_url',
            pago_verificado = ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            cupon_id = (p_pedido_data->>'cupon_id')::UUID,
            descuento_cupon_usd = v_cupon_descuento_usd,
            descuento_cupon_bs = v_cupon_descuento_bs,
            updated_at = NOW()
        WHERE id = p_existing_pedido_id AND cliente_id = v_user_id
        RETURNING * INTO v_pedido;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Pedido existente no encontrado');
        END IF;
        
        v_pedido_id := v_pedido.id;
        DELETE FROM public.pedido_items WHERE pedido_id = v_pedido_id;
    ELSE
        INSERT INTO public.pedidos (
            cliente_id, 
            metodo_pago_id, 
            referencia_pago, 
            total_usd, 
            total_bs, 
            estado, 
            comprobante_url, 
            pago_verificado, 
            cupon_id, 
            descuento_cupon_usd, 
            descuento_cupon_bs
        ) VALUES (
            v_user_id,
            (p_pedido_data->>'metodo_pago_id')::UUID,
            p_pedido_data->>'referencia_pago',
            v_calculated_total_usd,
            v_calculated_total_bs,
            p_pedido_data->>'estado',
            p_pedido_data->>'comprobante_url',
            ((p_pedido_data->>'pago_verificado')::BOOLEAN OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_USD_TOTAL%') OR (p_pedido_data->>'referencia_pago' LIKE 'PAGO_BILLETERA_BS_TOTAL%')),
            (p_pedido_data->>'cupon_id')::UUID,
            v_cupon_descuento_usd,
            v_cupon_descuento_bs
        ) RETURNING * INTO v_pedido;
        v_pedido_id := v_pedido.id;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        INSERT INTO public.pedido_items (
            pedido_id,
            producto_id,
            juego_nombre,
            producto_nombre,
            cantidad,
            precio_usd,
            precio_bs,
            metodo_recarga,
            player_id,
            zone_id,
            nickname,
            account_email,
            account_user,
            account_password,
            producto_icono
        ) VALUES (
            v_pedido_id,
            (v_item->>'producto_id')::INT,
            v_item->>'juego_nombre',
            v_item->>'producto_nombre',
            (v_item->>'cantidad')::INT,
            (v_item->>'precio_usd')::NUMERIC,
            (v_item->>'precio_bs')::NUMERIC,
            v_item->>'metodo_recarga',
            v_item->>'player_id',
            v_item->>'zone_id',
            v_item->>'nickname',
            v_item->>'account_email',
            v_item->>'account_user',
            v_item->>'account_password',
            v_item->>'producto_icono'
        );
    END LOOP;

    IF p_wallet_usd_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (v_user_id, -p_wallet_usd_deduct, 'pago_pedido', 'Pago Billetera - Pedido #' || v_pedido.numero_pedido::TEXT, v_pedido_id::TEXT, 'usd');
    END IF;

    IF p_wallet_bs_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (v_user_id, -p_wallet_bs_deduct, 'pago_pedido', 'Pago Billetera Bs - Pedido #' || v_pedido.numero_pedido::TEXT, v_pedido_id::TEXT, 'bs');
    END IF;

    RETURN json_build_object('success', true, 'pedido', row_to_json(v_pedido));
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
NOTIFY pgrst, 'reload schema';
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat > /tmp/214_fix.sql', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.exec('docker exec -i supabase-db psql -U postgres -d postgres < /tmp/214_fix.sql', (err, stream2) => {
        let out = '';
        stream2.on('close', () => {
          console.log('Done!');
          console.log(out);
          conn.end();
        }).on('data', d => out+=d).stderr.on('data', d => out+=d);
      });
    });
    stream.write(sqlContent);
    stream.end();
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo', readyTimeout: 30000 });
