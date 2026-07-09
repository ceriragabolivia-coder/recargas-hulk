-- ============================================
-- MIGRATION: Fix existing pagos_apk status
-- ============================================

-- Si un pago está vinculado a un pedido_id o usuario_id pero su estado quedó como 'disponible',
-- actualizarlo a 'usado' por seguridad, ya que la referencia ya fue procesada.
UPDATE public.pagos_apk
SET status = 'usado'
WHERE (pedido_id IS NOT NULL OR usuario_id IS NOT NULL) 
AND status = 'disponible';
