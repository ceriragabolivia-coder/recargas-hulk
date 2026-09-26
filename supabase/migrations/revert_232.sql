-- Revertir Migración 232: Memoria multiproveedor para productos

-- 1. Eliminar Triggers
DROP TRIGGER IF EXISTS trg_update_api_provider_ids ON public.productos;
DROP FUNCTION IF EXISTS public.update_api_provider_ids();

DROP TRIGGER IF EXISTS trg_update_productos_from_memory ON public.juegos;
DROP FUNCTION IF EXISTS public.update_productos_from_memory();

-- 2. Eliminar la columna de memoria
ALTER TABLE public.productos DROP COLUMN IF EXISTS api_provider_ids;
