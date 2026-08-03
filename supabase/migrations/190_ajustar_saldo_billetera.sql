-- Migración para crear las funciones RPC de ajuste manual de saldo

DROP FUNCTION IF EXISTS public.ajustar_saldo_billetera_rpc(uuid, uuid, numeric, text);
DROP FUNCTION IF EXISTS public.ajustar_saldo_billetera_bs_rpc(uuid, uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.ajustar_saldo_billetera_rpc(
    p_user_id UUID,
    p_admin_id UUID,
    p_nuevo_saldo NUMERIC,
    p_nota TEXT
) RETURNS JSONB AS $$
DECLARE
    v_saldo_actual NUMERIC;
    v_diferencia NUMERIC;
BEGIN
    -- Verificar si existe la billetera
    SELECT saldo INTO v_saldo_actual FROM public.billeteras WHERE auth_user_id = p_user_id;

    IF NOT FOUND THEN
        -- Si no existe, la creamos y asumimos que el saldo anterior era 0
        v_saldo_actual := 0;
        v_diferencia := p_nuevo_saldo;
        
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (p_user_id, p_nuevo_saldo, 0);
    ELSE
        -- Calculamos la diferencia
        v_diferencia := p_nuevo_saldo - v_saldo_actual;
        
        -- Actualizamos el saldo
        UPDATE public.billeteras
        SET saldo = p_nuevo_saldo, updated_at = now()
        WHERE auth_user_id = p_user_id;
    END IF;

    -- Registrar la transacción solo si hubo un cambio
    IF v_diferencia != 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, moneda)
        VALUES (
            p_user_id, 
            v_diferencia, 
            'ajuste_admin', 
            COALESCE(NULLIF(p_nota, ''), 'Ajuste manual de saldo USD por administrador'), 
            'usd'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Saldo ajustado correctamente');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.ajustar_saldo_billetera_bs_rpc(
    p_user_id UUID,
    p_admin_id UUID,
    p_nuevo_saldo NUMERIC,
    p_nota TEXT
) RETURNS JSONB AS $$
DECLARE
    v_saldo_actual NUMERIC;
    v_diferencia NUMERIC;
BEGIN
    -- Verificar si existe la billetera
    SELECT saldo_bs INTO v_saldo_actual FROM public.billeteras WHERE auth_user_id = p_user_id;

    IF NOT FOUND THEN
        -- Si no existe, la creamos y asumimos que el saldo anterior era 0
        v_saldo_actual := 0;
        v_diferencia := p_nuevo_saldo;
        
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (p_user_id, 0, p_nuevo_saldo);
    ELSE
        -- Calculamos la diferencia
        v_diferencia := p_nuevo_saldo - v_saldo_actual;
        
        -- Actualizamos el saldo
        UPDATE public.billeteras
        SET saldo_bs = p_nuevo_saldo, updated_at = now()
        WHERE auth_user_id = p_user_id;
    END IF;

    -- Registrar la transacción solo si hubo un cambio
    IF v_diferencia != 0 THEN
        INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, moneda)
        VALUES (
            p_user_id, 
            v_diferencia, 
            'ajuste_admin', 
            COALESCE(NULLIF(p_nota, ''), 'Ajuste manual de saldo Bs por administrador'), 
            'bs'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Saldo ajustado correctamente');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
