-- Agregar columna para la API Key de verificación de nombres
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS verificacion_api_key TEXT;

-- Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
