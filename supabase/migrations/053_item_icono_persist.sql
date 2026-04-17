-- ============================================
-- MIGRACIÓN 053: Persistencia de íconos en items
-- ============================================

-- 1. Añadir la columna para guardar el ícono en el momento de la compra
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS producto_icono TEXT;

-- 2. Backfill: Copiar los íconos actuales de la tabla productos a los items existentes
UPDATE public.pedido_items pi
SET producto_icono = p.icono_url
FROM public.productos p
WHERE pi.producto_id = p.id
AND pi.producto_icono IS NULL;

-- 3. Recargar schema
NOTIFY pgrst, 'reload schema';
