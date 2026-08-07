-- 193_fazercards_integration.sql

-- Alterar la columna proveedor_api_id a TEXT para soportar IDs de texto (como los de FazerCards).
-- Los números existentes (ej. TiendaGiftVen) se convertirán automáticamente a cadenas de texto sin pérdida de datos.
ALTER TABLE public.productos ALTER COLUMN proveedor_api_id TYPE TEXT USING proveedor_api_id::TEXT;

-- Añadir una nueva columna a la tabla juegos para almacenar el ID de categoría del proveedor
ALTER TABLE public.juegos ADD COLUMN IF NOT EXISTS api_provider_category_id TEXT;
