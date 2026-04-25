-- Migration: 067_configuracion_owner_constraint.sql
-- Description: Allow multiple businesses to have their own configuration keys.

-- 1. Remove old unique constraint on 'clave'
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;

-- 2. Add new unique constraint on (clave, owner_id)
-- Note: PostgreSQL handles NULL in unique constraints such that (clave, NULL) and (clave, NULL) are NOT considered duplicates.
-- However, we want only ONE global (NULL) record per clave, and ONE record per business owner per clave.
-- To fix this for NULLs, we can use a partial index or just assume owner_id is handled.
-- For standard UNIQUE(clave, owner_id), multiple NULLs are allowed.
-- To prevent multiple NULLs for the same clave:
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_clave_global_idx ON public.configuracion (clave) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_clave_owner_idx ON public.configuracion (clave, owner_id) WHERE owner_id IS NOT NULL;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
