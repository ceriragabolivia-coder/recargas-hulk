-- Migration: 204_auto_purge_receipts.sql
-- Description: Implementar purga automática de comprobantes de pago (imágenes) con más de 5 días de antigüedad en el bucket 'logos', bajo los prefijos 'pedidos/' y 'receipts/'.

CREATE OR REPLACE FUNCTION public.purge_old_receipts_fn()
RETURNS TRIGGER AS $$
BEGIN
    -- Eliminar objetos de storage con más de 5 días de antigüedad
    -- En Supabase, borrar registros de storage.objects físicamente elimina el archivo asociado en S3.
    DELETE FROM storage.objects
    WHERE bucket_id = 'logos' 
      AND (name LIKE 'pedidos/%' OR name LIKE 'receipts/%')
      AND created_at < NOW() - INTERVAL '5 days';
      
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usamos FOR EACH STATEMENT para que se ejecute una sola vez por cada inserción en pedidos,
-- evitando sobrecargar la base de datos si se insertan múltiples filas a la vez.
DROP TRIGGER IF EXISTS trig_purge_old_receipts ON public.pedidos;
CREATE TRIGGER trig_purge_old_receipts
AFTER INSERT ON public.pedidos
FOR EACH STATEMENT
EXECUTE FUNCTION public.purge_old_receipts_fn();

NOTIFY pgrst, 'reload schema';
