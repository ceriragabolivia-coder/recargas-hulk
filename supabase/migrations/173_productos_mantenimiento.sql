-- Agregar columna en_mantenimiento a la tabla productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS en_mantenimiento BOOLEAN DEFAULT false;
