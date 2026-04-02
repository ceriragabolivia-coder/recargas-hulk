-- ============================================
-- TABLA: Modificaciones para el Sistema Cashback Detalles
-- ============================================

-- Añadir columnas para almacenar los detalles exactos del cashback aplicado
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS cashback_monto NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_moneda TEXT,
ADD COLUMN IF NOT EXISTS cashback_porcentaje NUMERIC DEFAULT 0;

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
