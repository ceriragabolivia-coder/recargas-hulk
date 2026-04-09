-- Agregar columnas de características a la tabla juegos
ALTER TABLE juegos 
ADD COLUMN IF NOT EXISTS caracteristicas_tipo VARCHAR(100) DEFAULT 'Recarga (Automática)',
ADD COLUMN IF NOT EXISTS caracteristicas_region VARCHAR(100) DEFAULT 'Global',
ADD COLUMN IF NOT EXISTS caracteristicas_entrega VARCHAR(100) DEFAULT 'Inmediata',
ADD COLUMN IF NOT EXISTS caracteristicas_nota TEXT;

-- Insertar nuevas opciones de configuración para banners
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('promo_banner_texto', 'Gira y gana en nuestra ruleta SPINMAX Además obtén WP canjeables por créditos GRATIS! CLICK AQUÍ', 'Texto del banner principal del catálogo'),
('promo_banner_link', '/ruleta', 'Link de destino del banner principal'),
('promo_banner_icono_url', '', 'Ícono del banner principal'),
('tutorial_banner_texto', '¿Aún no sabes recargar vía Pago Móvil? Aquí tienes un video guía', 'Texto de la campanita en catálogo'),
('tutorial_banner_link', '#', 'Link destino de la campanita')
ON CONFLICT (clave) DO NOTHING;
