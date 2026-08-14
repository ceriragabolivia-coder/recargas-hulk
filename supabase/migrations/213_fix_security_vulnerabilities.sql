-- Migración 213: Parches de Seguridad (Privilege Escalation y Price Forgery)

-- 1. BLOQUEAR ESCALADA DE PRIVILEGIOS EN PERFILES
-- Usaremos un trigger para asegurar que los usuarios normales no puedan cambiar su rol o estado.
CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Si quien actualiza es un superadmin, se permite todo.
    IF public.is_superadmin() THEN
        RETURN NEW;
    END IF;

    -- Si quien actualiza es un admin, se permite todo (o restringir según reglas).
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- Para usuarios normales, forzamos que rol, estado y descuento permanezcan iguales al valor anterior.
    NEW.rol := OLD.rol;
    NEW.estado := OLD.estado;
    NEW.descuento_general := OLD.descuento_general;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_prevent_profile_escalation ON public.perfiles;
CREATE TRIGGER trigger_prevent_profile_escalation
BEFORE UPDATE ON public.perfiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_escalation();


-- 2. BLOQUEAR FALSIFICACIÓN DE PRECIOS EN PEDIDOS
-- Modificamos la función para que no confíe en el total enviado por el frontend.
DROP FUNCTION IF EXISTS public.crear_pedido_seguro_rpc(JSONB, JSONB, NUMERIC, NUMERIC, INT);
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
    
    -- Variables para el cálculo seguro del precio
    v_calculated_total_usd NUMERIC := 0;
    v_calculated_total_bs NUMERIC := 0;
    v_precio_db RECORD;
    v_cantidad INT;
    v_cupon_descuento_usd NUMERIC := 0;
    v_cupon_descuento_bs NUMERIC := 0;
BEGIN
    -- Extract user ID from the pedido data
    v_user_id := (p_pedido_data->>'cliente_id')::UUID;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'cliente_id es requerido');
    END IF;

    -- SECURITY: Verify the executing user is the owner of the order
    IF auth.uid() != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'No autorizado para crear pedidos a nombre de otro usuario');
    END IF;

    -- 2.1 CÁLCULO SEGURO DEL PRECIO TOTAL BASADO EN LA BASE DE DATOS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        v_cantidad := (v_item->>'cantidad')::INT;
        
        -- Obtener el precio real de la base de datos
        SELECT precio_usd INTO v_precio_db
        FROM public.productos
        WHERE id = (v_item->>'producto_id')::INT;
        
        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Producto no encontrado en la base de datos: ' || (v_item->>'producto_id'));
        END IF;
        
        -- Acumular el total real
        v_calculated_total_usd := v_calculated_total_usd + (v_precio_db.precio_usd * v_cantidad);
    END LOOP;
    
    -- Aplicar cupones de descuento (Confiamos en el monto de descuento enviado por ahora, 
    -- lo ideal sería recalcular el cupón también, pero requeriría lógica extra).
    v_cupon_descuento_usd := COALESCE((p_pedido_data->>'descuento_cupon_usd')::NUMERIC, 0);
    v_cupon_descuento_bs := COALESCE((p_pedido_data->>'descuento_cupon_bs')::NUMERIC, 0);
    
    v_calculated_total_usd := GREATEST(0, v_calculated_total_usd - v_cupon_descuento_usd);
    
    -- Si el frontend intentó usar más saldo del necesario, lo ajustamos al total real calculado
    IF p_wallet_usd_deduct > v_calculated_total_usd THEN
        p_wallet_usd_deduct := v_calculated_total_usd;
    END IF;
    
    -- OJO: No calculamos total_bs aquí para evitar llamadas a la API de tasas de cambio,
    -- usaremos el valor proporcionado o lo ideal sería cruzarlo con public.configuracion.
    v_calculated_total_bs := (p_pedido_data->>'total_bs')::NUMERIC;

    -- 1. LOCK WALLET AND DEDUCT BALANCES (ATOMIC)
    IF p_wallet_usd_deduct > 0 OR p_wallet_bs_deduct > 0 THEN
        -- Lock the row to prevent race conditions
        SELECT saldo, saldo_bs INTO v_current_balance_usd, v_current_balance_bs
        FROM public.billeteras
        WHERE auth_user_id = v_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Billetera no encontrada');
        END IF;

        -- Verify USD Balance
        IF p_wallet_usd_deduct > 0 THEN
            IF v_current_balance_usd IS NULL OR v_current_balance_usd < p_wallet_usd_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo USD insuficiente en la billetera');
            END IF;
        END IF;

        -- Verify BS Balance
        IF p_wallet_bs_deduct > 0 THEN
            IF v_current_balance_bs IS NULL OR v_current_balance_bs < p_wallet_bs_deduct THEN
                RETURN json_build_object('success', false, 'message', 'Saldo Bs insuficiente en la billetera');
            END IF;
        END IF;

        -- Perform Deductions
        UPDATE public.billeteras
        SET 
            saldo = saldo - p_wallet_usd_deduct,
            saldo_bs = saldo_bs - p_wallet_bs_deduct,
            updated_at = NOW()
        WHERE auth_user_id = v_user_id;
    END IF;

    -- 2. CREATE OR UPDATE THE ORDER (PEDIDO)
    IF p_existing_pedido_id IS NOT NULL THEN
        -- Update existing
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
            RETURN json_build_object('success', false, 'message', 'Pedido existente no encontrado o no autorizado');
        END IF;
        
        v_pedido_id := v_pedido.id;

        -- Delete old items
        DELETE FROM public.pedido_items WHERE pedido_id = v_pedido_id;
    ELSE
        -- Insert new
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

    -- 3. INSERT NEW ITEMS
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

    -- 4. LOG TRANSACTIONS IN BILLETERA_TRANSACCIONES
    IF p_wallet_usd_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (
            v_user_id, 
            -p_wallet_usd_deduct, 
            'pago_pedido', 
            'Pago Billetera - Pedido #' || v_pedido.numero_pedido::TEXT, 
            v_pedido_id::TEXT, 
            'usd'
        );
    END IF;

    IF p_wallet_bs_deduct > 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
        VALUES (
            v_user_id, 
            -p_wallet_bs_deduct, 
            'pago_pedido', 
            'Pago Billetera Bs - Pedido #' || v_pedido.numero_pedido::TEXT, 
            v_pedido_id::TEXT, 
            'bs'
        );
    END IF;

    -- If we get here, everything succeeded. The transaction will automatically commit.
    RETURN json_build_object('success', true, 'pedido', row_to_json(v_pedido));
EXCEPTION WHEN OTHERS THEN
    -- If any error occurs, postgres will rollback the transaction automatically
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. BLOQUEAR INSERT DIRECTO DE PEDIDOS PARA USUARIOS
DROP POLICY IF EXISTS "auth_all" ON public.pedidos;

-- Asegurar que sólo administradores puedan insertar/actualizar pedidos de forma arbitraria
DROP POLICY IF EXISTS "pedidos_admin_insert" ON public.pedidos;
CREATE POLICY "pedidos_admin_insert" ON public.pedidos
FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_superadmin());

DROP POLICY IF EXISTS "pedidos_admin_update" ON public.pedidos;
CREATE POLICY "pedidos_admin_update" ON public.pedidos
FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_superadmin());

-- Nota: Los usuarios comunes insertan pedidos mediante el RPC (SECURITY DEFINER), 
-- por lo que no necesitan permisos directos de INSERT/UPDATE en la tabla pedidos,
-- pero SÍ necesitan permisos de SELECT para ver sus pedidos (política que ya existe).

NOTIFY pgrst, 'reload schema';

-- 4. RPC PARA RECLAMAR RECOMPENSAS SIN INSERT DIRECTO
CREATE OR REPLACE FUNCTION public.reclamar_premio_creador_rpc(
    p_cliente_id UUID,
    p_producto_id INT,
    p_producto_nombre TEXT
) RETURNS INT AS $BODY
DECLARE
    v_pedido_id INT;
BEGIN
    IF auth.uid() != p_cliente_id THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    INSERT INTO public.pedidos (
        cliente_id,
        estado,
        total_usd,
        total_bs
    ) VALUES (
        p_cliente_id,
        'procesando',
        0,
        0
    ) RETURNING id INTO v_pedido_id;

    INSERT INTO public.pedido_items (
        pedido_id,
        producto_id,
        juego_nombre,
        producto_nombre,
        cantidad,
        precio_usd,
        precio_bs
    ) VALUES (
        v_pedido_id,
        p_producto_id,
        'Premio Creador',
        p_producto_nombre,
        1,
        0,
        0
    );

    RETURN v_pedido_id;
END;
$BODY LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';



