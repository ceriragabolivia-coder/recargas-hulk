-- Migration: 054_rename_billetera_recargas_reference.sql
-- Description: Rename 'referencia' to 'referencia_pago' in billetera_recargas for consistency across the schema

ALTER TABLE public.billetera_recargas RENAME COLUMN referencia TO referencia_pago;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
