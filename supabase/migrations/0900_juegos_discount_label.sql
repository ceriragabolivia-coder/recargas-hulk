-- 090_juegos_discount_label.sql
-- Añadir columna para etiqueta de descuento visual
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS etiqueta_descuento TEXT;

-- Asegurar que la columna sea legible por anon
-- (Como ya habilitamos public_read_juegos en la migración 089, esto debería funcionar automáticamente)

COMMENT ON COLUMN juegos.etiqueta_descuento IS 'Etiqueta de descuento visual para la landing (ej: -25%). No afecta al cálculo real de precios.';
