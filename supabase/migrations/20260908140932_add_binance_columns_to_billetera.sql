ALTER TABLE public.billetera_recargas 
ADD COLUMN IF NOT EXISTS binance_verificado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS binance_transfer_id TEXT;
