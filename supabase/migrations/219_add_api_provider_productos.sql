-- Añadir columnas para configuración de API a nivel de producto
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS api_provider TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS api_provider_category_id TEXT;
