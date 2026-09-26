-- Migration: 226_tutorial_obligatorio_juegos.sql
-- Description: Add tutorial_video, tutorial_titulo, and tutorial_activo to public.juegos

ALTER TABLE public.juegos
ADD COLUMN IF NOT EXISTS tutorial_video TEXT,
ADD COLUMN IF NOT EXISTS tutorial_titulo TEXT,
ADD COLUMN IF NOT EXISTS tutorial_activo BOOLEAN DEFAULT FALSE;
