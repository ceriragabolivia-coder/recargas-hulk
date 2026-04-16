-- ============================================
-- MIGRACIÓN: Referencia de Recargas Individual
-- ============================================

ALTER TABLE pedido_items 
ADD COLUMN IF NOT EXISTS referencia_admin VARCHAR(100);

-- Recargar el caché del esquema de Supabase
NOTIFY pgrst, 'reload schema';
