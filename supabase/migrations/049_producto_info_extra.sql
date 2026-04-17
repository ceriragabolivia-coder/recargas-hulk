-- Migración para añadir soporte de información adicional en paquetes

ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS info_adicional_texto TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS info_adicional_imagen_url VARCHAR(500) DEFAULT NULL;
