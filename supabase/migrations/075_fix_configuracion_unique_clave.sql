-- Migration: 075_fix_configuracion_unique_clave.sql
-- Description: Asegura que la columna 'clave' sea única para permitir actualizaciones automáticas (UPSERT).

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'configuracion_clave_key'
    ) THEN
        ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
    END IF;
END $$;
