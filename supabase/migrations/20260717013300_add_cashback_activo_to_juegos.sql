ALTER TABLE public.juegos
ADD COLUMN IF NOT EXISTS cashback_activo BOOLEAN DEFAULT true;
