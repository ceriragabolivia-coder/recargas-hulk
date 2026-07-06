-- ============================================
-- TABLA: Pagos recibidos desde APK
-- ============================================

CREATE TABLE IF NOT EXISTS public.pagos_apk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referencia TEXT UNIQUE NOT NULL,
    monto NUMERIC NOT NULL,
    banco_origen TEXT,
    banco_destino TEXT,
    telefono TEXT,
    fecha_pago TIMESTAMPTZ,
    status TEXT DEFAULT 'recibido',
    pedido_id INT REFERENCES public.pedidos(id) ON DELETE SET NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas')
);

-- RLS
ALTER TABLE public.pagos_apk ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
-- Permitir a los administradores leer todo
CREATE POLICY "Admins pueden ver pagos_apk" ON public.pagos_apk
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND (rol = 'admin' OR rol = 'superadmin' OR rol = 'empleado')
        )
    );

-- Permitir a administradores actualizar
CREATE POLICY "Admins pueden actualizar pagos_apk" ON public.pagos_apk
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND (rol = 'admin' OR rol = 'superadmin' OR rol = 'empleado')
        )
    );
