-- Asegurar que los juegos que ya tenían lógica de verificación la tengan activa en la base de datos
UPDATE juegos SET verificacion_api_activa = TRUE 
WHERE LOWER(nombre) LIKE '%free fire%' 
   OR LOWER(nombre) LIKE '%blood strike%';

-- Asegurar que el resto no sea null
UPDATE juegos SET verificacion_api_activa = FALSE 
WHERE verificacion_api_activa IS NULL;

-- Recargar PostgREST
NOTIFY pgrst, 'reload schema';
