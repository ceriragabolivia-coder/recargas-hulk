-- Migration 105: Añadir columnas faltantes a notificaciones_usuarios
-- Resuelve el error 'column "tipo" does not exist'

ALTER TABLE public.notificaciones_usuarios 
ADD COLUMN IF NOT EXISTS tipo TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Notificar recarga de caché
NOTIFY pgrst, 'reload schema';
