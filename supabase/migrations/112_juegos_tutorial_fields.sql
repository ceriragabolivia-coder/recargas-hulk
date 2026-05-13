-- Migration: Add tutorial fields to juegos table
ALTER TABLE juegos
ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT,
ADD COLUMN IF NOT EXISTS tutorial_banner_texto TEXT,
ADD COLUMN IF NOT EXISTS tutorial_banner_img TEXT;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
