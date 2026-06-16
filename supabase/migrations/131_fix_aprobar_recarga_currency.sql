-- Migration: 131_fix_aprobar_recarga_currency.sql
-- Description: Restaura el soporte de moneda (USD/Bs) al aprobar recargas que fue sobrescrito en el parche 073, manteniendo la seguridad de is_admin().

CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_moneda TEXT;
BEGIN
    -- SEGURIDAD: Solo un ADMIN real puede aprobar
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No tienes permisos de administrador para realizar esta acción.';
    END IF;

    -- 1. Check if recharge is pending
    SELECT auth_user_id, monto, COALESCE(moneda, 'usd')
    INTO v_user_id, v_amount, v_moneda
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN 
        RETURN FALSE; 
    END IF;

    -- 2. Mark as approved
    UPDATE public.billetera_recargas
    SET estado = 'aprobado', 
        atendido_por_id = auth.uid(), -- Usamos auth.uid() real por seguridad
        notas_admin = p_notas, 
        updated_at = now()
    WHERE id = p_recarga_id;

    -- 3. Update or Insert wallet balance based on currency
    IF v_moneda = 'bs' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_user_id, 0, v_amount)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + v_amount, updated_at = now();
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo)
        VALUES (v_user_id, v_amount)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo = public.billeteras.saldo + v_amount, updated_at = now();
    END IF;

    -- 4. Log Transaction with currency
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (v_user_id, v_amount, 'recarga', 'Recarga de billetera aprobada', p_recarga_id, v_moneda);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
