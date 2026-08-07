-- Migration: 198_drop_pedidos_prevent_auto_verify.sql
-- Description: Drop the obsolete trigger that was incorrectly nullifying pago_verificado for wallet payments.
-- Since order creation is now handled securely by crear_pedido_seguro_rpc, this trigger is no longer needed and causes bugs with auto-processing.

DROP TRIGGER IF EXISTS tr_pedidos_prevent_auto_verify ON public.pedidos;
DROP FUNCTION IF EXISTS public.pedidos_prevent_auto_verify();
