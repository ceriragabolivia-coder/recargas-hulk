-- 20. Crear bucket 'soporte_archivos' y sus políticas de seguridad

-- 1. Crear el bucket público si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('soporte_archivos', 'soporte_archivos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir que cualquier persona pueda VER/LEER los archivos públicos
DROP POLICY IF EXISTS "Acceso Público a soporte_archivos" ON storage.objects;
CREATE POLICY "Acceso Público a soporte_archivos" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'soporte_archivos' );

-- 3. Permitir que los usuarios autenticados PUEDAN SUBIR archivos
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden subir archivos" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'soporte_archivos' AND auth.role() = 'authenticated' );

-- 4. Permitir que los usuarios autenticados PUEDAN BORRAR sus propios archivos
DROP POLICY IF EXISTS "Usuarios autenticados pueden borrar sus archivos" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden borrar sus archivos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'soporte_archivos' AND auth.uid() = owner );
