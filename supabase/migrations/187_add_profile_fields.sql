-- Agregando campos al perfil de clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
ADD COLUMN IF NOT EXISTS estado VARCHAR(100),
ADD COLUMN IF NOT EXISTS genero VARCHAR(50),
ADD COLUMN IF NOT EXISTS instagram_link VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_link VARCHAR(255),
ADD COLUMN IF NOT EXISTS juegos_favoritos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
