-- MIGRATION: debug insert
CREATE OR REPLACE FUNCTION debug_insert_cupon(p_codigo TEXT, p_usuario_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cupon RECORD;
BEGIN
    SELECT * INTO v_cupon FROM public.cupones WHERE codigo = p_codigo;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cupon not found');
    END IF;

    BEGIN
        INSERT INTO public.cupones_usuarios (cupon_id, usuario_id, usos) 
        VALUES (v_cupon.id, p_usuario_id, 0);
        
        RETURN jsonb_build_object('success', true, 'msg', 'Inserted');
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
