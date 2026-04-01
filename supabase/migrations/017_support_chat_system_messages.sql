-- Add a column to mark automated system messages in support chat
ALTER TABLE soporte_mensajes
ADD COLUMN IF NOT EXISTS es_sistema BOOLEAN DEFAULT false;

-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';
