-- ============================================
-- Migración 024: Descuentos de Revendedores
-- ============================================

-- Agregar campo descuento_revendedor a tabla juegos
-- Representa el descuento global (%) del revendedor para ese servicio
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS descuento_revendedor NUMERIC DEFAULT 0;

-- Agregar campo descuento_revendedor a tabla productos 
-- Representa el descuento local (%) para ese producto (NULL ignora, usa el del juego)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento_revendedor NUMERIC DEFAULT NULL;

-- Aseguramos que el esquema se recargue
NOTIFY pgrst, 'reload schema';
