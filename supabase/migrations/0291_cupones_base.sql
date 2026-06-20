-- ============================================================
-- Migración 0291: Tablas base del sistema de cupones
-- (Esta migración faltaba en el proyecto original)
-- ============================================================

-- 1. Tabla principal de cupones
CREATE TABLE IF NOT EXISTS public.cupones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'descuento_porcentaje', -- 'descuento_porcentaje' | 'descuento_fijo' | 'saldo_usd' | 'saldo_bs'
    valor NUMERIC NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    fecha_expiracion TIMESTAMPTZ,
    usos_maximos INTEGER,
    usos_actuales INTEGER DEFAULT 0,
    limite_usos_por_usuario INTEGER,
    frecuencia_uso VARCHAR(20) DEFAULT 'unico',
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de cupones usados (historial)
CREATE TABLE IF NOT EXISTS public.cupones_usados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cupon_id UUID REFERENCES public.cupones(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    pedido_id INTEGER REFERENCES public.pedidos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupones_usados ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer cupones activos
DROP POLICY IF EXISTS "cupones_select_activos" ON public.cupones;
CREATE POLICY "cupones_select_activos" ON public.cupones
    FOR SELECT USING (true);

-- Solo admins pueden gestionar cupones
DROP POLICY IF EXISTS "cupones_admin_all" ON public.cupones;
CREATE POLICY "cupones_admin_all" ON public.cupones
    FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Usuarios autenticados pueden insertar uso de cupón
DROP POLICY IF EXISTS "cupones_usados_insert_auth" ON public.cupones_usados;
CREATE POLICY "cupones_usados_insert_auth" ON public.cupones_usados
    FOR INSERT TO authenticated WITH CHECK (true);

-- Usuarios ven sus propios usos
DROP POLICY IF EXISTS "cupones_usados_select_own" ON public.cupones_usados;
CREATE POLICY "cupones_usados_select_own" ON public.cupones_usados
    FOR SELECT USING (cliente_id = auth.uid() OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Admin puede gestionar todo
DROP POLICY IF EXISTS "cupones_usados_admin_all" ON public.cupones_usados;
CREATE POLICY "cupones_usados_admin_all" ON public.cupones_usados
    FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

NOTIFY pgrst, 'reload schema';
