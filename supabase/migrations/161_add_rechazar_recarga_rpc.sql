-- Migration: Add rechazar_recarga_rpc
CREATE OR REPLACE FUNCTION public.rechazar_recarga_rpc(p_recarga_id UUID, p_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_recarga_estado TEXT;
BEGIN
    -- 1. Verificar si la recarga existe y está pendiente
    SELECT estado INTO v_recarga_estado
    FROM public.billetera_recargas
    WHERE id = p_recarga_id FOR UPDATE;

    IF v_recarga_estado IS NULL THEN
        RAISE EXCEPTION 'Recarga no encontrada.';
    END IF;

    IF v_recarga_estado != 'pendiente' THEN
        RAISE EXCEPTION 'La recarga ya fue procesada (estado actual: %).', v_recarga_estado;
    END IF;

    -- 2. Actualizar la recarga a rechazado
    UPDATE public.billetera_recargas
    SET estado = 'rechazado',
        atendido_por_id = p_admin_id,
        updated_at = now()
    WHERE id = p_recarga_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
