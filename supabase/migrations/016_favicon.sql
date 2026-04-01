-- 1. Añadir campo de texto a la tabla de configuración
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS valor_texto TEXT;

-- 2. Insertar la nueva clave para el favicon
INSERT INTO configuracion (clave, valor, valor_texto, descripcion) 
VALUES ('favicon_url', 0, '', 'URL del Favicon del sistema')
ON CONFLICT (clave) DO NOTHING;
