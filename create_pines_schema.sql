CREATE TABLE IF NOT EXISTS pines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    monto NUMERIC NOT NULL,
    moneda VARCHAR(10) NOT NULL CHECK (moneda IN ('usd', 'bs')),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'canjeado')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    canjeado_en TIMESTAMP WITH TIME ZONE,
    canjeado_por UUID REFERENCES auth.users(id)
);

CREATE OR REPLACE FUNCTION canjear_pin(
    p_codigo VARCHAR,
    p_user_id UUID
) RETURNS JSON AS $$
DECLARE
    v_pin RECORD;
    v_billetera RECORD;
    v_nuevo_saldo NUMERIC;
BEGIN
    -- Bloquear el pin para lectura concurrente
    SELECT * INTO v_pin FROM pines WHERE codigo = p_codigo FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Pin no encontrado.');
    END IF;

    IF v_pin.estado = 'canjeado' THEN
        RETURN json_build_object('success', false, 'message', 'El pin ya ha sido canjeado.');
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

    -- Marcar pin como canjeado
    UPDATE pines 
    SET estado = 'canjeado', canjeado_en = NOW(), canjeado_por = p_user_id 
    WHERE id = v_pin.id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Pin canjeado exitosamente.', 
        'monto', v_pin.monto, 
        'moneda', v_pin.moneda, 
        'nuevo_saldo', v_nuevo_saldo
    );
END;
$$ LANGUAGE plpgsql;
