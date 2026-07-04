-- ==============================================================================
-- Migration: 150_add_chat_file_columns
-- Description: Agrega las columnas archivo_url y tipo_archivo a la tabla 
-- soporte_mensajes, necesarias para la funcionalidad de adjuntar archivos en el chat.
-- ==============================================================================

ALTER TABLE public.soporte_mensajes 
ADD COLUMN IF NOT EXISTS archivo_url TEXT,
ADD COLUMN IF NOT EXISTS tipo_archivo VARCHAR(50);

-- Refrescar el esquema para que la API de Supabase reconozca las nuevas columnas
NOTIFY pgrst, 'reload schema';
