-- Migration 146: Agregar columna observaciones a la tabla pedidos
-- Causa: Error "Could not find the 'observaciones' column of 'pedidos' in the schema cache" al cancelar o actualizar observaciones.

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- Recargar el esquema de PostgREST
NOTIFY pgrst, 'reload schema';
