-- Eliminar las sobrecargas posibles 
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, integer, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, integer, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, uuid, text);

-- Función para pagos en USD
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
    v_superadmin_id UUID;
BEGIN
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Descontar de la billetera general del usuario
    UPDATE public.billeteras
    SET saldo = saldo - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- Registro del usuario
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id, 'usd');

    -- Buscar super admin
    SELECT u.id INTO v_superadmin_id 
    FROM auth.users u 
    WHERE LOWER(u.email) = 'ceriraga@gmail.com' LIMIT 1;

    -- Acreditar al saldo OPERATIVO del super admin
    IF v_superadmin_id IS NOT NULL AND v_superadmin_id != p_user_id THEN
        INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, saldo_bs)
        VALUES (v_superadmin_id, p_amount, 0)
        ON CONFLICT (auth_user_id) DO UPDATE
        SET saldo_usd = public.admin_saldos.saldo_usd + p_amount,
            updated_at = now();

        INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
        VALUES (v_superadmin_id, p_pedido_id, 'credito_venta', 'usd', p_amount, 'Ingreso por pago de pedido con billetera (USD)');
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Función para pagos en Bolívares
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
    v_superadmin_id UUID;
BEGIN
    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Descontar de la billetera general del usuario
    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- Registro del usuario
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id, 'bs');

    -- Buscar super admin
    SELECT u.id INTO v_superadmin_id 
    FROM auth.users u 
    WHERE LOWER(u.email) = 'ceriraga@gmail.com' LIMIT 1;

    -- Acreditar al saldo OPERATIVO del super admin
    IF v_superadmin_id IS NOT NULL AND v_superadmin_id != p_user_id THEN
        INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, saldo_bs)
        VALUES (v_superadmin_id, 0, p_amount)
        ON CONFLICT (auth_user_id) DO UPDATE
        SET saldo_bs = public.admin_saldos.saldo_bs + p_amount,
            updated_at = now();

        INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
        VALUES (v_superadmin_id, p_pedido_id, 'credito_venta', 'bs', p_amount, 'Ingreso por pago de pedido con billetera (Bs)');
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
