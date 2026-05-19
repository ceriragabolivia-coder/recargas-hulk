-- Migration: 126_add_tipo_producto.sql
-- Description: Add tipo_producto column to productos to distinguish between recargas and gift cards

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS tipo_producto VARCHAR(20) DEFAULT 'recarga';

-- Ensure all existing products are defaulted to 'recarga' just in case
UPDATE public.productos SET tipo_producto = 'recarga' WHERE tipo_producto IS NULL;

NOTIFY pgrst, 'reload schema';
