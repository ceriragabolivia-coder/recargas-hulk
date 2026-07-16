-- Add parent_id to juegos for region variants
ALTER TABLE public.juegos
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES public.juegos(id) ON DELETE CASCADE;

-- Add index to speed up querying children
CREATE INDEX IF NOT EXISTS idx_juegos_parent_id ON public.juegos(parent_id);
