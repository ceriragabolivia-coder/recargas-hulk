-- Migration: 056_control_referencias.sql
-- Description: Sistema de blindaje para evitar referencias de pago duplicadas en las últimas 48 horas.

-- 1. Tabla de control interno para log de referencias
CREATE TABLE IF NOT EXISTS public.referencias_pagos_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referencia TEXT NOT NULL,
    monto_registrado NUMERIC(15, 2),
    usuario_id UUID REFERENCES auth.users(id),
    origen TEXT, -- 'pedido', 'billetera', 'admin'
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas')
);

-- Índice para búsquedas rápidas de referencias recientes
CREATE INDEX IF NOT EXISTS idx_referencias_control_referencia ON public.referencias_pagos_control(referencia);
CREATE INDEX IF NOT EXISTS idx_referencias_control_created_at ON public.referencias_pagos_control(created_at);

-- 2. Función RPC para validar y registrar una referencia de forma atómica
CREATE OR REPLACE FUNCTION public.validar_y_registrar_referencia_rpc(
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_origen TEXT
) RETURNS JSONB AS $$
DECLARE
    v_existe BOOLEAN;
BEGIN
    -- Limpiar la referencia (quitar espacios, etc si fuera necesario, pero el frontend ya lo hace)
    p_referencia := TRIM(p_referencia);

    -- Verificar si existe en las últimas 48 horas
    SELECT EXISTS (
        SELECT 1 FROM public.referencias_pagos_control
        WHERE referencia = p_referencia
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_existe;

    IF v_existe THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referencia Duplicada');
    END IF;

    -- Si no existe, registrarla para blindar futuros intentos
    INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen)
    VALUES (p_referencia, p_monto, p_usuario_id, p_origen);

    RETURN jsonb_build_object('success', true, 'message', 'Referencia válida y registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Poblar la tabla con datos recientes de pedidos y billetera para protección inmediata
INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen, created_at)
SELECT referencia_pago, total_bs, cliente_id, 'pedido', created_at
FROM public.pedidos
WHERE referencia_pago IS NOT NULL 
AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
ON CONFLICT DO NOTHING;

INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen, created_at)
SELECT referencia_pago, monto, auth_user_id, 'billetera', created_at
FROM public.billetera_recargas
WHERE referencia_pago IS NOT NULL 
AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.referencias_pagos_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view reference control" ON public.referencias_pagos_control
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));
