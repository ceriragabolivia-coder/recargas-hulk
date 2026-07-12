-- Migration 169: Vincular Códigos de Creador a Usuarios Web

-- 1. Agregar la columna usuario_id referenciando a perfiles
ALTER TABLE public.codigos_creadores ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- 2. Recargar el schema
NOTIFY pgrst, 'reload schema';
