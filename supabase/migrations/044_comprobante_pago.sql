-- Migración 044: Comprobante de Pago en Pedidos
-- Añade columna comprobante_url a la tabla pedidos

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- Función para limpiar comprobantes de pedidos con más de 20 días
CREATE OR REPLACE FUNCTION public.limpiar_comprobantes_antiguos()
RETURNS JSONB AS $$
DECLARE
  v_limpiados INT;
BEGIN
  -- Limpiar la URL de comprobante en pedidos con más de 20 días
  UPDATE public.pedidos
  SET comprobante_url = NULL
  WHERE comprobante_url IS NOT NULL
    AND created_at < (NOW() - INTERVAL '20 days');
  
  GET DIAGNOSTICS v_limpiados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'comprobantes_limpiados', v_limpiados
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.limpiar_comprobantes_antiguos() TO authenticated, anon;

-- Notificar al esquema
NOTIFY pgrst, 'reload schema';
