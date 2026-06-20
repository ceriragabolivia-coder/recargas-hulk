-- Add landing visibility and ordering to juegos table
ALTER TABLE juegos
ADD COLUMN IF NOT EXISTS mostrar_en_landing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS orden_landing INTEGER DEFAULT 0;

-- Ensure existing global games are visible by default
UPDATE juegos
SET mostrar_en_landing = true
WHERE owner_id IS NULL AND mostrar_en_landing IS NULL;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
