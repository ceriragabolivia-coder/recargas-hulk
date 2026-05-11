-- Set a high default value for orden_landing so new games appear at the bottom
ALTER TABLE public.juegos ALTER COLUMN orden_landing SET DEFAULT 999;

-- Also update any existing games that have 0 but aren't Free Fire to 999 so they go to the bottom (optional, but let's just do it for games that don't look sorted)
-- Actually, let's just let the user re-sort. But we must fix the ones that are currently 0.
-- Wait, the user already sorted everything else!
-- So the ones with > 0 are sorted. The ones with 0 are Free Fire (which the user put at 0) and newly created games.
UPDATE public.juegos 
SET orden_landing = 999 
WHERE orden_landing = 0 AND nombre != 'Free Fire';

-- Also notify postgrest
NOTIFY pgrst, 'reload schema';
