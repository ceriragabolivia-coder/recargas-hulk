-- Migration 168: RPC para registrar uso de código creador

CREATE OR REPLACE FUNCTION public.registrar_uso_codigo_creador(
    p_codigo_id UUID,
    p_usuario_id UUID
)
RETURNS void AS $$
BEGIN
    -- Incrementar usos globales del código
    UPDATE public.codigos_creadores 
    SET usos_totales = usos_totales + 1 
    WHERE id = p_codigo_id;

    -- Incrementar contador de compras del usuario
    UPDATE public.clientes
    SET compras_con_codigo_creador = compras_con_codigo_creador + 1
    WHERE auth_user_id = p_usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.registrar_uso_codigo_creador(UUID, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
