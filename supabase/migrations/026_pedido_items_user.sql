-- ============================================
-- Migración 026: Agregar account_user a pedido_items
-- ============================================

ALTER TABLE public.pedido_items 
ADD COLUMN IF NOT EXISTS account_user TEXT;

-- Recargar el schema cache
NOTIFY pgrst, 'reload schema';
