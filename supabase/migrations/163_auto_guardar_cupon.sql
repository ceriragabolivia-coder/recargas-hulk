-- ============================================
-- MIGRATION: Auto-guardar cupón al validar
-- ============================================

-- Modificamos la función para que, cuando un cupón sea válido, se asocie automáticamente
-- al usuario (con usos=0 si no existía) para que aparezca en "Mis Cupones".
CREATE OR REPLACE FUNCTION validar_cupon_rpc(p_codigo TEXT, p_usuario_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cupon RECORD;
    v_uso_usuario INT;
BEGIN
    SELECT * INTO v_cupon FROM public.cupones WHERE codigo = p_codigo;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón no existe.');
    END IF;

    IF NOT v_cupon.activo THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón está inactivo.');
    END IF;

    IF v_cupon.fecha_inicio IS NOT NULL AND NOW() < v_cupon.fecha_inicio THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón aún no está disponible.');
    END IF;

    IF v_cupon.fecha_fin IS NOT NULL AND NOW() > v_cupon.fecha_fin THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón ha expirado.');
    END IF;

    IF v_cupon.max_usos_global IS NOT NULL AND v_cupon.usos_actuales >= v_cupon.max_usos_global THEN
        RETURN jsonb_build_object('valido', false, 'mensaje', 'El cupón ha alcanzado su límite máximo de usos global.');
    END IF;

    IF v_cupon.max_usos_usuario IS NOT NULL THEN
        SELECT usos INTO v_uso_usuario FROM public.cupones_usuarios WHERE cupon_id = v_cupon.id AND usuario_id = p_usuario_id;
        IF FOUND AND v_uso_usuario >= v_cupon.max_usos_usuario THEN
            RETURN jsonb_build_object('valido', false, 'mensaje', 'Ya has utilizado este cupón el número máximo de veces.');
        END IF;
    END IF;

    -- REGISTRAR EN LA BILLETERA DE "MIS CUPONES" (Solo si no estaba ya registrado)
    IF p_usuario_id IS NOT NULL THEN
        INSERT INTO public.cupones_usuarios (cupon_id, usuario_id, usos) 
        VALUES (v_cupon.id, p_usuario_id, 0)
        ON CONFLICT (cupon_id, usuario_id) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'valido', true, 
        'id', v_cupon.id, 
        'codigo', v_cupon.codigo, 
        'porcentaje_descuento', v_cupon.porcentaje_descuento
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
