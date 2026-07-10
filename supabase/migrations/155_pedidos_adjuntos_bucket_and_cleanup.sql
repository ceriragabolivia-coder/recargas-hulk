-- 1. Crear el bucket 'pedidos-adjuntos' si no existe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pedidos-adjuntos', 'pedidos-adjuntos', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de seguridad para el bucket 'pedidos-adjuntos'
DROP POLICY IF EXISTS "Pedidos Adjuntos: Acceso Público" ON storage.objects;
CREATE POLICY "Pedidos Adjuntos: Acceso Público" ON storage.objects 
  FOR SELECT USING (bucket_id = 'pedidos-adjuntos');

DROP POLICY IF EXISTS "Pedidos Adjuntos: Admins pueden subir" ON storage.objects;
CREATE POLICY "Pedidos Adjuntos: Admins pueden subir" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'pedidos-adjuntos' AND EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND (rol = 'admin' OR rol = 'superadmin' OR rol = 'operario')));

DROP POLICY IF EXISTS "Pedidos Adjuntos: Admins pueden borrar" ON storage.objects;
CREATE POLICY "Pedidos Adjuntos: Admins pueden borrar" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'pedidos-adjuntos' AND EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND (rol = 'admin' OR rol = 'superadmin' OR rol = 'operario')));

-- 3. Función maestra para limpiar capturas viejas (tanto de clientes como de admins)
CREATE OR REPLACE FUNCTION public.limpiar_capturas_viejas()
RETURNS JSONB AS $$
DECLARE
  v_limpiados_clientes INT;
  v_limpiados_admins INT;
BEGIN
  -- A. Limpiar referencias en la tabla pedidos (capturas de clientes > 15 días)
  UPDATE public.pedidos
  SET comprobante_url = NULL
  WHERE comprobante_url IS NOT NULL
    AND created_at < (NOW() - INTERVAL '15 days');
  GET DIAGNOSTICS v_limpiados_clientes = ROW_COUNT;

  -- B. Limpiar referencias en la tabla pedidos (adjuntos de admins > 15 días)
  UPDATE public.pedidos
  SET imagenes_adjuntas = NULL
  WHERE imagenes_adjuntas IS NOT NULL
    AND created_at < (NOW() - INTERVAL '15 days');

  -- C. Borrar FÍSICAMENTE los archivos de Storage (ahorra espacio)
  DELETE FROM storage.objects
  WHERE (bucket_id = 'comprobantes' OR bucket_id = 'pedidos-adjuntos')
    AND created_at < (NOW() - INTERVAL '15 days');
  GET DIAGNOSTICS v_limpiados_admins = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'referencias_limpiadas', v_limpiados_clientes,
    'archivos_eliminados_storage', v_limpiados_admins
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.limpiar_capturas_viejas() TO authenticated, anon;
