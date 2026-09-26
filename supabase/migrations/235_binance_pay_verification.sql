-- Migración 235: Soporte para verificación automática de Binance Pay
-- Agrega columnas a billetera_recargas para guardar el Transfer ID de Binance
-- y una bandera de verificación automática.

ALTER TABLE public.billetera_recargas
  ADD COLUMN IF NOT EXISTS binance_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS binance_verificado BOOLEAN DEFAULT FALSE;

-- Índice para búsquedas rápidas por Transfer ID
CREATE INDEX IF NOT EXISTS idx_billetera_recargas_binance_transfer_id
  ON public.billetera_recargas (binance_transfer_id)
  WHERE binance_transfer_id IS NOT NULL;

SELECT 'OK: binance_transfer_id column added' AS result;
