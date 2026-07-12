-- Migration 172: Saldo como recompensa de creadores

-- 1. Modificar creador_objetivos para soportar tipo y valor de recompensas
ALTER TABLE public.creador_objetivos 
ADD COLUMN IF NOT EXISTS recompensa_1_tipo VARCHAR DEFAULT 'producto',
ADD COLUMN IF NOT EXISTS recompensa_1_valor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS recompensa_2_tipo VARCHAR DEFAULT 'producto',
ADD COLUMN IF NOT EXISTS recompensa_2_valor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS recompensa_3_tipo VARCHAR DEFAULT 'producto',
ADD COLUMN IF NOT EXISTS recompensa_3_valor NUMERIC DEFAULT 0;

-- 2. Modificar creador_recompensas_canjeadas para guardar info de saldos canjeados
ALTER TABLE public.creador_recompensas_canjeadas 
ADD COLUMN IF NOT EXISTS tipo_recompensa_canjeada VARCHAR,
ADD COLUMN IF NOT EXISTS valor_recompensa_canjeada NUMERIC;

-- 3. Crear RPC para canjear y dar saldo
CREATE OR REPLACE FUNCTION public.recompensar_creador_billetera_rpc(
    p_creador_auth_id UUID,
    p_monto NUMERIC,
    p_moneda TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Crear billetera si no existe
    INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
    VALUES (p_creador_auth_id, 0, 0)
    ON CONFLICT (auth_user_id) DO NOTHING;

    -- Agregar saldo a la moneda correspondiente
    IF p_moneda = 'bs' THEN
        UPDATE public.billeteras 
        SET saldo_bs = saldo_bs + p_monto, updated_at = now() 
        WHERE auth_user_id = p_creador_auth_id;
    ELSE
        UPDATE public.billeteras 
        SET saldo = saldo + p_monto, updated_at = now() 
        WHERE auth_user_id = p_creador_auth_id;
    END IF;

    -- Registrar la transaccion
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, moneda)
    VALUES (
        p_creador_auth_id, 
        p_monto, 
        'ajuste_admin', 
        'Recompensa por meta de creador alcanzada', 
        p_moneda
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recargar el schema
NOTIFY pgrst, 'reload schema';
