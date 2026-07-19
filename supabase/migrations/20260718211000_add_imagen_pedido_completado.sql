-- Añadir columna para imagen de pedido completado en juegos
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS imagen_pedido_completado_url TEXT;
