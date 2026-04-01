-- ============================================
-- Migración 025: Soporte para rol "revendedor"
-- ============================================

-- 1. Eliminar el CHECK constraint del campo rol para permitir 'revendedor'
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- 2. Añadir nuevamente el constraint con 'revendedor' incluido
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_rol_check 
CHECK (rol IN ('admin', 'cliente', 'revendedor'));

-- 3. Agregar columna porcentaje_descuento si no existe
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS porcentaje_descuento NUMERIC DEFAULT 0;

-- 4. Agregar estado extendido (suspendido y baneado) si aún tiene el check restrictivo
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_estado_check;
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_estado_check 
CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'suspendido', 'baneado'));

-- Recargar el schema cache
NOTIFY pgrst, 'reload schema';
