-- Migration: 134_mi_participacion_rpc.sql
-- Description: RPC de auto-consulta para que un socio vea su propio capital, % de
-- participación, saldo de utilidad e historial — sin exponer el capital individual
-- de otros socios (la RLS de socios_capital solo permite ver la fila propia).

CREATE OR REPLACE FUNCTION public.obtener_mi_participacion_rpc()
RETURNS JSONB AS $$
DECLARE
    v_socio_id UUID := auth.uid();
    v_capital_propio NUMERIC;
    v_capital_total NUMERIC;
    v_saldo_utilidad NUMERIC;
    v_historial_capital JSONB;
    v_historial_utilidad JSONB;
BEGIN
    IF v_socio_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
    END IF;

    SELECT COALESCE(capital_aportado_usd, 0) INTO v_capital_propio
    FROM public.socios_capital WHERE auth_user_id = v_socio_id;

    SELECT COALESCE(SUM(capital_aportado_usd), 0) INTO v_capital_total
    FROM public.socios_capital WHERE capital_aportado_usd > 0;

    SELECT COALESCE(saldo_utilidad_bs, 0) INTO v_saldo_utilidad
    FROM public.socios_utilidad WHERE auth_user_id = v_socio_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tipo_movimiento', h.tipo_movimiento,
        'monto_usd', h.monto_usd,
        'notas', h.notas,
        'created_at', h.created_at
    ) ORDER BY h.created_at DESC), '[]'::jsonb) INTO v_historial_capital
    FROM public.socios_capital_historial h
    WHERE h.socio_id = v_socio_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tipo_movimiento', h.tipo_movimiento,
        'monto_bs', h.monto_bs,
        'notas', h.notas,
        'created_at', h.created_at
    ) ORDER BY h.created_at DESC), '[]'::jsonb) INTO v_historial_utilidad
    FROM public.socios_utilidad_historial h
    WHERE h.socio_id = v_socio_id;

    RETURN jsonb_build_object(
        'success', true,
        'capital_propio_usd', COALESCE(v_capital_propio, 0),
        'capital_total_usd', v_capital_total,
        'porcentaje', CASE WHEN v_capital_total > 0 THEN ROUND((COALESCE(v_capital_propio, 0) / v_capital_total) * 100, 4) ELSE 0 END,
        'saldo_utilidad_bs', COALESCE(v_saldo_utilidad, 0),
        'historial_capital', v_historial_capital,
        'historial_utilidad', v_historial_utilidad
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
