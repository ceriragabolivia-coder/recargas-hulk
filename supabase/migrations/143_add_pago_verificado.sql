-- Agregar columna pago_verificado a la tabla pedidos
-- true = pago verificado por admin, false = pago rechazado, null = sin verificar aún

ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS pago_verificado BOOLEAN DEFAULT NULL;

-- Índice para consultas frecuentes por estado de verificación
CREATE INDEX IF NOT EXISTS idx_pedidos_pago_verificado ON pedidos(pago_verificado);
