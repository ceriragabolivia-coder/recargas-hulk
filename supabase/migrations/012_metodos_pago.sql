-- Tabla para métodos de pago
CREATE TABLE IF NOT EXISTS public.metodos_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    datos TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos pueden ver métodos activos, solo admin puede editar
CREATE POLICY "Métodos de pago visibles para todos" ON public.metodos_pago
    FOR SELECT USING (true);

CREATE POLICY "Admin gestiona métodos de pago" ON public.metodos_pago
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE auth_user_id = auth.uid() AND rol = 'admin'
        )
    );
