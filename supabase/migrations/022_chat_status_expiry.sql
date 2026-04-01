-- Migration 022: Add timestamp to track when support status was last changed
ALTER TABLE IF EXISTS public.clientes 
ADD COLUMN IF NOT EXISTS soporte_status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have a timestamp if they have a status
UPDATE public.clientes 
SET soporte_status_changed_at = NOW() 
WHERE soporte_status IS NOT NULL;
