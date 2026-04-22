-- Migration: 060_add_zone_id_to_saved_accounts.sql
-- Description: Añade soporte para Zone ID en las cuentas guardadas.

ALTER TABLE public.cuentas_guardadas ADD COLUMN IF NOT EXISTS zone_id TEXT;

-- Actualizar comentarios
COMMENT ON COLUMN public.cuentas_guardadas.zone_id IS 'ID de zona para cuentas guardadas que lo requieren (ej. Mobile Legends)';
