-- Migration: 052_pagos_admins.sql
-- Description: Sistema de saldos y liquidación para administradores basado en ventas

-- 1. Tabla de saldos
CREATE TABLE IF NOT EXISTS public.admin_saldos (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    saldo_bs NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_saldos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver todos los saldos" ON public.admin_saldos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- 2. Tabla historial
CREATE TABLE IF NOT EXISTS public.admin_saldos_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('credito_venta', 'reverso_venta', 'liquidacion')),
    moneda VARCHAR(10) NOT NULL CHECK (moneda IN ('usd', 'bs')),
    monto NUMERIC(15, 2) NOT NULL,
    notas TEXT,
    liquidado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_saldos_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins pueden ver historial saldos" ON public.admin_saldos_historial
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- 3. Trigger Function on Pedidos
CREATE OR REPLACE FUNCTION public.trig_act_saldos_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_is_bs BOOLEAN := false;
    v_metodo_pago RECORD;
    v_moneda TEXT;
    v_monto NUMERIC;
BEGIN
    -- Determinar moneda basándonos en metodo_pago o referencia
    IF NEW.referencia_pago ILIKE '%billetera bs%' OR NEW.referencia_pago ILIKE '%pago móvil%' OR NEW.referencia_pago ILIKE '%bolívares%' OR NEW.referencia_pago ILIKE '%bs%' THEN
        v_is_bs := true;
    ELSIF NEW.metodo_pago_id IS NOT NULL THEN
        SELECT nombre, habilitado_billetera_bs INTO v_metodo_pago FROM public.metodos_pago WHERE id = NEW.metodo_pago_id;
        IF v_metodo_pago.habilitado_billetera_bs = true OR v_metodo_pago.nombre ILIKE '%pago%' OR v_metodo_pago.nombre ILIKE '%bs%' OR v_metodo_pago.nombre ILIKE '%bolívares%' THEN
            v_is_bs := true;
        END IF;
    END IF;

    IF v_is_bs THEN
        v_moneda := 'bs';
        v_monto := NEW.total_bs;
    ELSE
        v_moneda := 'usd';
        v_monto := NEW.total_usd;
    END IF;

    -- Si no hay monto válido, simplemente salir
    IF v_monto IS NULL OR v_monto = 0 THEN
        RETURN NEW;
    END IF;

    -- CASO 1: Pedido cambia a COMPLETADO
    IF NEW.estado = 'completado' AND (TG_OP = 'INSERT' OR OLD.estado != 'completado') THEN
        IF NEW.atendido_por_id IS NOT NULL THEN
            -- Upsert para crear la billetera si no existe
            INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, saldo_bs)
            VALUES (NEW.atendido_por_id, 
                    CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END, 
                    CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END)
            ON CONFLICT (auth_user_id) 
            DO UPDATE SET 
                saldo_usd = public.admin_saldos.saldo_usd + CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END,
                saldo_bs = public.admin_saldos.saldo_bs + CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END,
                updated_at = now();

            -- Registrar historial
            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (NEW.atendido_por_id, NEW.id, 'credito_venta', v_moneda, v_monto, 'Crédito automático por venta de pedido #' || NEW.numero_pedido);
        END IF;

    -- CASO 2: Pedido deja de ser COMPLETADO (Reembolso, cancelación, o reversión manual)
    ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'completado' AND NEW.estado != 'completado' THEN
        IF OLD.atendido_por_id IS NOT NULL THEN
            -- Restar el saldo generado anteriormente
            UPDATE public.admin_saldos
            SET saldo_usd = saldo_usd - CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END,
                saldo_bs = saldo_bs - CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END,
                updated_at = now()
            WHERE auth_user_id = OLD.atendido_por_id;

            -- Registrar historial (Notar que el monto aquí es positivo, pero el tipo_movimiento define que es reverso)
            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (OLD.atendido_por_id, OLD.id, 'reverso_venta', v_moneda, v_monto, 'Reverso por cambio de estado en pedido #' || OLD.numero_pedido || ' de completado a ' || NEW.estado);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_act_saldos_admin_pedidos ON public.pedidos;
CREATE TRIGGER trig_act_saldos_admin_pedidos
AFTER INSERT OR UPDATE OF estado ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trig_act_saldos_admin();

-- 4. RPC para Liquidar Saldo
CREATE OR REPLACE FUNCTION public.liquidar_saldo_admin_rpc(
    p_admin_id UUID,
    p_liquidador_id UUID,
    p_moneda VARCHAR(10),
    p_monto NUMERIC,
    p_notas TEXT DEFAULT 'Liquidación a administrador'
) RETURNS JSONB AS $$
DECLARE
    v_saldo_actual NUMERIC;
BEGIN
    IF p_moneda NOT IN ('usd', 'bs') THEN
        RETURN jsonb_build_object('error', 'Moneda inválida (debe ser usd o bs)');
    END IF;

    -- Obtener saldo bloqueando la fila
    IF p_moneda = 'usd' THEN
        SELECT saldo_usd INTO v_saldo_actual FROM public.admin_saldos WHERE auth_user_id = p_admin_id FOR UPDATE;
    ELSE
        SELECT saldo_bs INTO v_saldo_actual FROM public.admin_saldos WHERE auth_user_id = p_admin_id FOR UPDATE;
    END IF;

    IF v_saldo_actual IS NULL THEN
        RETURN jsonb_build_object('error', 'El administrador no posee billetera de saldos');
    END IF;

    IF v_saldo_actual < p_monto THEN
        RETURN jsonb_build_object('error', 'Saldo insuficiente para liquidar este monto (Saldo actual: ' || v_saldo_actual || ')');
    END IF;

    -- Descontar saldo
    IF p_moneda = 'usd' THEN
        UPDATE public.admin_saldos SET saldo_usd = saldo_usd - p_monto, updated_at = now() WHERE auth_user_id = p_admin_id;
    ELSE
        UPDATE public.admin_saldos SET saldo_bs = saldo_bs - p_monto, updated_at = now() WHERE auth_user_id = p_admin_id;
    END IF;

    -- Registrar movimiento
    INSERT INTO public.admin_saldos_historial (admin_id, tipo_movimiento, moneda, monto, notas, liquidado_por_id)
    VALUES (p_admin_id, 'liquidacion', p_moneda, p_monto, p_notas, p_liquidador_id);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificar a postgREST
NOTIFY pgrst, 'reload schema';
