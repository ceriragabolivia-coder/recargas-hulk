-- Migration: 023_wallet_system.sql
-- Description: Digital Wallet system for balances, recharges, and transactions

-- 1. Table for Balances
CREATE TABLE IF NOT EXISTS public.billeteras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_billeteras_auth_user_id ON public.billeteras(auth_user_id);

-- 2. Table for Recharge Requests
CREATE TABLE IF NOT EXISTS public.billetera_recargas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monto NUMERIC(12, 2) NOT NULL,
    metodo_pago_id UUID NOT NULL REFERENCES public.metodos_pago(id),
    referencia TEXT NOT NULL,
    comprobante_url TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    notas_admin TEXT,
    atendido_por_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table for Transaction History (Audit)
CREATE TABLE IF NOT EXISTS public.billetera_transacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monto NUMERIC(12, 2) NOT NULL, -- Positive for credit, negative for debit
    tipo TEXT NOT NULL CHECK (tipo IN ('recarga', 'pago_pedido', 'ajuste_admin', 'reembolso')),
    descripcion TEXT,
    referencia_id UUID, -- Can be id from billetera_recargas or pedidos
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS (Row Level Security)
ALTER TABLE public.billeteras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billetera_recargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billetera_transacciones ENABLE ROW LEVEL SECURITY;

-- Policies for billeteras
CREATE POLICY "Users can view their own wallet" ON public.billeteras
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all wallets" ON public.billeteras
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Policies for billetera_recargas
CREATE POLICY "Users can view and create their own recharges" ON public.billetera_recargas
    FOR ALL USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view and manage all recharges" ON public.billetera_recargas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Policies for billetera_transacciones
CREATE POLICY "Users can view their own transactions" ON public.billetera_transacciones
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all transactions" ON public.billetera_transacciones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- 5. RPC (Stored Procedures) for atomic operations

-- Function to approve a recharge safely
CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
BEGIN
    -- 1. Check if recharge is pending
    SELECT auth_user_id, monto INTO v_user_id, v_amount
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Mark as approved
    UPDATE public.billetera_recargas
    SET estado = 'aprobado',
        atendido_por_id = p_admin_id,
        notas_admin = p_notas,
        updated_at = now()
    WHERE id = p_recarga_id;

    -- 3. Update or Insert wallet balance
    INSERT INTO public.billeteras (auth_user_id, saldo)
    VALUES (v_user_id, v_amount)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo = public.billeteras.saldo + v_amount, updated_at = now();

    -- 4. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (v_user_id, v_amount, 'recarga', 'Recarga de billetera aprobada', p_recarga_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to pay with wallet balance safely
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- 1. Fetch current balance with lock
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- 2. Deduct amount
    UPDATE public.billeteras
    SET saldo = saldo - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- 3. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for balance updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.billeteras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.billetera_recargas;
