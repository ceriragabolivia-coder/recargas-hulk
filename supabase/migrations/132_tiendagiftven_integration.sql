-- ============================================
-- Migración 132: Integración TiendaGiftVen API
-- ============================================

-- 1. Agregar ID del producto proveedor a la tabla productos
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS proveedor_api_id INT;

-- 2. Agregar tracking del pedido proveedor a pedido_items
ALTER TABLE public.pedido_items 
ADD COLUMN IF NOT EXISTS estado_proveedor VARCHAR(30),
ADD COLUMN IF NOT EXISTS proveedor_pedido_id INT,
ADD COLUMN IF NOT EXISTS mensaje_proveedor TEXT;
