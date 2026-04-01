-- Añadir columna icono_url a la tabla productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS icono_url TEXT;
