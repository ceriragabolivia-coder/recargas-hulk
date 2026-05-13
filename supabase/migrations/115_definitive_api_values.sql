-- Actualización masiva definitiva
UPDATE juegos SET verificacion_api_activa = TRUE 
WHERE LOWER(nombre) LIKE '%free fire%' 
   OR LOWER(nombre) LIKE '%blood strike%';

UPDATE juegos SET verificacion_api_activa = FALSE 
WHERE verificacion_api_activa IS NULL;

-- Notificación de recarga de esquema
NOTIFY pgrst, 'reload schema';
