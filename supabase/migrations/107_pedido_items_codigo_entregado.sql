-- Añadir columna codigo_entregado a la tabla pedido_items
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS codigo_entregado TEXT;

-- Recargar el caché del esquema de PostgREST
NOTIFY pgrst, 'reload schema';
