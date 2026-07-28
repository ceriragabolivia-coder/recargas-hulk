-- Migration: 186_aprobar_recarga_automatica_rpc.sql
-- Description: RPC para auto-aprobar recargas desde el backend (Vercel) cuando coinciden con la API del banco (BDV).

CREATE OR REPLACE FUNCTION aprobar_recarga_automatica_bdv_rpc(
    p_recarga_id UUID,
    p_notas TEXT DEFAULT 'Recarga automática de saldo vía API BDV'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recarga RECORD;
BEGIN
    -- 1. Buscar la recarga
    SELECT * INTO v_recarga FROM public.billetera_recargas WHERE id = p_recarga_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Recarga no encontrada.');
    END IF;

    IF v_recarga.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('success', false, 'message', 'La recarga ya no está pendiente.');
    END IF;

    -- 2. Aprobar la recarga
    UPDATE public.billetera_recargas
    SET estado = 'aprobado', notas_admin = p_notas, updated_at = NOW()
    WHERE id = p_recarga_id;

    -- 3. Insertar transacción
    INSERT INTO public.billetera_transacciones (
        auth_user_id, tipo, monto, moneda, descripcion, referencia_id
    ) VALUES (
        v_recarga.auth_user_id, 'recarga', v_recarga.monto, COALESCE(v_recarga.moneda, 'usd'), 
        p_notas, 
        p_recarga_id
    );

    -- 4. Actualizar billetera
    IF COALESCE(v_recarga.moneda, 'usd') = 'usd' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (v_recarga.auth_user_id, v_recarga.monto, 0)
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET saldo = public.billeteras.saldo + EXCLUDED.saldo;
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (v_recarga.auth_user_id, 0, v_recarga.monto)
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + EXCLUDED.saldo_bs;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Recarga auto-aprobada con éxito por BDV API.');
END;
$$;

NOTIFY pgrst, 'reload schema';
