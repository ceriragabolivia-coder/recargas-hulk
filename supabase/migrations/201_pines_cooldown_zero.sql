CREATE OR REPLACE FUNCTION public.canjear_pin(
    p_codigo VARCHAR,
    p_user_id UUID
) RETURNS JSON AS $$
DECLARE
    v_pin RECORD;
    v_billetera RECORD;
    v_nuevo_saldo NUMERIC;
    v_tx_id UUID;
    v_nombre_usuario VARCHAR;
    v_ultima_recarga TIMESTAMP WITH TIME ZONE;
    v_cooldown_minutos INTEGER;
BEGIN
    -- Obtener la configuración del tiempo de espera (5 minutos por defecto)
    SELECT COALESCE((SELECT valor::integer FROM configuracion WHERE clave = 'tiempo_espera_pines' LIMIT 1), 5) INTO v_cooldown_minutos;

    -- Solo aplicar cooldown si es mayor a 0
    IF v_cooldown_minutos > 0 THEN
        -- Verificar el cooldown comparando con el último canje
        SELECT canjeado_en INTO v_ultima_recarga 
        FROM pines 
        WHERE canjeado_por = p_user_id 
        ORDER BY canjeado_en DESC NULLS LAST 
        LIMIT 1;

        IF v_ultima_recarga IS NOT NULL AND (v_ultima_recarga + (v_cooldown_minutos * interval '1 minute')) > NOW() THEN
            RETURN json_build_object(
                'success', false, 
                'message', 'Debes esperar ' || v_cooldown_minutos || ' minutos entre cada canje de pin.'
            );
        END IF;
    END IF;

    -- Bloquear el pin para lectura concurrente
    SELECT * INTO v_pin FROM pines WHERE codigo = p_codigo FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Pin inválido.');
    END IF;

    IF v_pin.estado = 'canjeado' THEN
        -- Buscar nombre de quien canjeó
        SELECT (COALESCE(nombres, '') || ' ' || COALESCE(apellidos, '')) INTO v_nombre_usuario 
        FROM clientes WHERE auth_user_id = v_pin.canjeado_por LIMIT 1;
        
        IF v_nombre_usuario IS NULL OR v_nombre_usuario = ' ' THEN
            v_nombre_usuario := 'un usuario';
        END IF;

        RETURN json_build_object(
            'success', false, 
            'message', 'El pin ya ha sido canjeado por ' || v_nombre_usuario || ' (Transacción #' || SUBSTRING(v_pin.transaccion_id::text FROM 1 FOR 8) || ') el ' || to_char(v_pin.canjeado_en, 'DD/MM/YYYY HH24:MI:SS')
        );
    END IF;

    -- Obtener la billetera del usuario
    SELECT * INTO v_billetera FROM billeteras WHERE auth_user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        -- Crear billetera si no existe
        INSERT INTO billeteras (auth_user_id, saldo, saldo_bs) 
        VALUES (p_user_id, 0, 0) RETURNING * INTO v_billetera;
    END IF;

    -- Actualizar saldo según la moneda
    IF v_pin.moneda = 'usd' THEN
        v_nuevo_saldo := COALESCE(v_billetera.saldo, 0) + v_pin.monto;
        UPDATE billeteras SET saldo = v_nuevo_saldo WHERE auth_user_id = p_user_id;
    ELSIF v_pin.moneda = 'bs' THEN
        v_nuevo_saldo := COALESCE(v_billetera.saldo_bs, 0) + v_pin.monto;
        UPDATE billeteras SET saldo_bs = v_nuevo_saldo WHERE auth_user_id = p_user_id;
    END IF;

    -- Crear el registro en billetera_transacciones
    INSERT INTO billetera_transacciones (auth_user_id, monto, tipo, descripcion, moneda, created_at)
    VALUES (p_user_id, v_pin.monto, 'recarga', 'Canje de Pin de Recarga: ' || p_codigo, v_pin.moneda, NOW())
    RETURNING id INTO v_tx_id;

    -- Marcar pin como canjeado guardando el id de transacción
    UPDATE pines 
    SET estado = 'canjeado', canjeado_en = NOW(), canjeado_por = p_user_id, transaccion_id = v_tx_id
    WHERE id = v_pin.id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Pin canjeado exitosamente.', 
        'monto', v_pin.monto, 
        'moneda', v_pin.moneda, 
        'nuevo_saldo', v_nuevo_saldo,
        'transaccion_id', v_tx_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificar a postgREST para que recargue el schema
NOTIFY pgrst, 'reload schema';
