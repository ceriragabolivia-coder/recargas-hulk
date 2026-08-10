DROP TRIGGER IF EXISTS trig_purge_old_receipts ON public.pedidos;
DROP FUNCTION IF EXISTS public.purge_old_receipts_fn();
NOTIFY pgrst, 'reload schema';
