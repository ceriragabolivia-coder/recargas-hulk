-- 1. Crear tabla mensajes_sistema si no existe
CREATE TABLE IF NOT EXISTS public.mensajes_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    imagen_url TEXT,
    link_url TEXT,
    activo BOOLEAN DEFAULT true,
    creado_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.mensajes_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read system messages" ON public.mensajes_sistema;
CREATE POLICY "Public read system messages" ON public.mensajes_sistema
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage system messages" ON public.mensajes_sistema;
CREATE POLICY "Admin manage system messages" ON public.mensajes_sistema
    FOR ALL TO authenticated USING (
        public.is_admin() OR public.is_superadmin()
    );

-- 3. Añadir programación horaria
ALTER TABLE public.mensajes_sistema ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE public.mensajes_sistema ADD COLUMN IF NOT EXISTS hora_fin TIME;

COMMENT ON COLUMN public.mensajes_sistema.hora_inicio IS 'Hora a la que el popup debe empezar a mostrarse (HH:MM:SS)';
COMMENT ON COLUMN public.mensajes_sistema.hora_fin IS 'Hora a la que el popup debe dejar de mostrarse (HH:MM:SS)';
