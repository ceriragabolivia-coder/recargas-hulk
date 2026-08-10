-- Migration: 206_add_url_canje.sql
-- Description: Añadir columna url_canje a la tabla juegos

ALTER TABLE public.juegos ADD COLUMN IF NOT EXISTS url_canje TEXT;

NOTIFY pgrst, 'reload schema';
