-- Add instrucciones_recarga to juegos table
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS instrucciones_recarga TEXT;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
