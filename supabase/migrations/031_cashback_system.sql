-- ============================================
-- TABLA: Modificaciones para el Sistema Cashback
-- ============================================

-- 1. Insertar configuración por defecto para cashback si no existe
INSERT INTO configuracion (clave, valor, valor_texto)
VALUES ('cashback_activo', 0, 'false')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO configuracion (clave, valor)
VALUES ('cashback_porcentaje', '0.0')
ON CONFLICT (clave) DO NOTHING;

-- 2. Añadir columna cashback_aplicado en la tabla pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS cashback_aplicado BOOLEAN DEFAULT FALSE;

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
