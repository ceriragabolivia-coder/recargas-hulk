-- Add opciones_recarga to juegos table

ALTER TABLE public.juegos
ADD COLUMN IF NOT EXISTS opciones_recarga JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
