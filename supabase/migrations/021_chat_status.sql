-- Migration 021: Add support status to 'clientes' table for chat categorization
ALTER TABLE IF EXISTS public.clientes 
ADD COLUMN IF NOT EXISTS soporte_status TEXT CHECK (soporte_status IN ('resuelto', 'pendiente', 'critico'));

-- Index for performance when filtering chats by status
CREATE INDEX IF NOT EXISTS idx_clientes_soporte_status ON public.clientes(soporte_status);
