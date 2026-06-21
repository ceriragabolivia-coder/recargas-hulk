-- Migration 141: Add missing columns to juegos table
-- Adds guia_id_url (guide image for ID field) and mostrar_precio_dual (dual price display toggle)

ALTER TABLE juegos
ADD COLUMN IF NOT EXISTS guia_id_url TEXT,
ADD COLUMN IF NOT EXISTS mostrar_precio_dual BOOLEAN DEFAULT false;

-- Notify PostgREST to reload the schema cache so API picks up new columns
NOTIFY pgrst, 'reload schema';
