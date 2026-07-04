-- Fix foreign key for cliente_id in ventas table to point to auth.users instead of public.clientes

ALTER TABLE public.ventas
  DROP CONSTRAINT IF EXISTS ventas_cliente_id_fkey;

ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES auth.users(id) ON DELETE CASCADE;
