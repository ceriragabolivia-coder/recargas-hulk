CREATE OR REPLACE FUNCTION asignar_cupon_todos_usuarios_rpc(p_cupon_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cupon RECORD;
BEGIN
    SELECT * INTO v_cupon FROM public.cupones WHERE id = p_cupon_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'El cupón no existe.');
    END IF;
    
    WITH inserted AS (
        INSERT INTO public.cupones_usuarios (cupon_id, usuario_id, usos)
        SELECT p_cupon_id, auth_user_id, 0 
        FROM public.clientes 
        WHERE auth_user_id IS NOT NULL
        ON CONFLICT (cupon_id, usuario_id) DO NOTHING
        RETURNING usuario_id
    )
    INSERT INTO public.notificaciones_usuarios (user_id, titulo, mensaje)
    SELECT 
        usuario_id,
        '¡Te han regalado un cupón! 🎁',
        'Has recibido un cupón de ' || v_cupon.porcentaje_descuento || '% de descuento. Usa el código: ' || v_cupon.codigo || ' en tu próxima compra.'
    FROM inserted;
    
    RETURN jsonb_build_object('success', true, 'message', 'Cupón asignado exitosamente a todos los usuarios.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
