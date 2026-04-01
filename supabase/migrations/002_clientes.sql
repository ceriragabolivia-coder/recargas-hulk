-- Migration: Create clientes table
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    password_correo TEXT,
    whatsapp TEXT,
    nickname TEXT,
    pais TEXT DEFAULT 'Venezuela',
    estado TEXT,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ultimo_login TIMESTAMP WITH TIME ZONE,
    ip_registro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Permitir lectura a autenticados" ON public.clientes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserción a autenticados" ON public.clientes
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualización a autenticados" ON public.clientes
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir eliminación a autenticados" ON public.clientes
    FOR DELETE TO authenticated USING (true);
