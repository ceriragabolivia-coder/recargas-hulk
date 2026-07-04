-- Migration 143: Agregar columnas faltantes a perfiles
-- PROBLEMA: perfiles no tiene motivo_estado, porcentaje_descuento, config_modulos

ALTER TABLE public.perfiles
    ADD COLUMN IF NOT EXISTS motivo_estado    TEXT,
    ADD COLUMN IF NOT EXISTS porcentaje_descuento NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS config_modulos   JSONB   DEFAULT '[]'::jsonb;

-- Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';
