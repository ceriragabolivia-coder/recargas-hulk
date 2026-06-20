-- 116_paginas_estaticas.sql
-- Crear tabla para páginas estáticas (CMS) del footer
CREATE TABLE IF NOT EXISTS paginas_estaticas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT, -- Contenido HTML o texto enriquecido
    categoria TEXT NOT NULL DEFAULT 'Empresa', -- 'Empresa', 'Soporte', etc.
    visible BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE paginas_estaticas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Public read access for paginas_estaticas" ON paginas_estaticas
    FOR SELECT TO anon, authenticated USING (visible = true);

CREATE POLICY "Admin full access for paginas_estaticas" ON paginas_estaticas
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM perfiles
            WHERE id = auth.uid()
            AND (rol = 'admin' OR rol = 'administrador')
        )
    );

-- Insertar datos iniciales basados en el footer actual
INSERT INTO paginas_estaticas (slug, titulo, contenido, categoria, orden) VALUES
('nosotros', 'Nosotros', '<h1>Sobre Nosotros</h1><p>Bienvenido a Recargas Ceriraga, tu plataforma líder en recargas y servicios digitales en Venezuela.</p>', 'Empresa', 1),
('terminos', 'Términos y Condiciones', '<h1>Términos y Condiciones</h1><p>Contenido de los términos y condiciones de uso.</p>', 'Empresa', 2),
('privacidad', 'Privacidad', '<h1>Política de Privacidad</h1><p>Tu privacidad es importante para nosotros.</p>', 'Empresa', 3),
('faq', 'Preguntas Frecuentes', '<h1>Preguntas Frecuentes</h1><p>Encuentra respuestas a las dudas más comunes.</p>', 'Soporte', 1),
('contacto', 'Contacto WhatsApp', '<h1>Contacto</h1><p>Comunícate con nosotros vía WhatsApp.</p>', 'Soporte', 2),
('estado', 'Estado del Sistema', '<h1>Estado del Sistema</h1><p>Todos los servicios operativos.</p>', 'Soporte', 3)
ON CONFLICT (slug) DO NOTHING;
