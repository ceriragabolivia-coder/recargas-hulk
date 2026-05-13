-- Agregar columnas para configuración de API de verificación de nombres
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS verificacion_api_activa BOOLEAN DEFAULT FALSE;
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS verificacion_api_url TEXT;

-- Actualizar los juegos existentes que ya tienen APIs implementadas para que estén activas por defecto
UPDATE juegos SET verificacion_api_activa = TRUE 
WHERE LOWER(nombre) LIKE '%free fire%' 
   OR LOWER(nombre) LIKE '%blood strike%';

-- Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
