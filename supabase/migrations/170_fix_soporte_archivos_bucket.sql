-- 170_fix_soporte_archivos_bucket.sql
-- Restaurar el acceso público al bucket de soporte para que las imágenes puedan ser mostradas en el chat

UPDATE storage.buckets SET public = true WHERE id = 'soporte_archivos';

DO $$ BEGIN
    -- Eliminar políticas de lectura privada si existen
    DROP POLICY IF EXISTS "Soporte: Ver propios o admin" ON storage.objects;
    
    -- Recrear política de acceso público
    DROP POLICY IF EXISTS "Acceso Público a soporte_archivos" ON storage.objects;
    CREATE POLICY "Acceso Público a soporte_archivos" ON storage.objects 
    FOR SELECT USING ( bucket_id = 'soporte_archivos' );
END $$;
