-- Migración 246: Integración Proveedor API Xanler
-- Configuración de claves para la API de Xanler (Host to Host)

INSERT INTO public.configuracion (clave, valor_texto, valor, descripcion)
VALUES
  ('xanler_api_key', '', 0, 'API Key para integración con Xanler (Host to Host)'),
  ('xanler_api_secret', '', 0, 'API Secret para integración con Xanler (Host to Host)')
ON CONFLICT (clave) DO NOTHING;
