-- Migration: 066_negocio_role_support.sql
-- Description: Implement "Negocio" role with data isolation and module configuration.

-- 1. Update roles check constraint
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_rol_check 
CHECK (rol IN ('admin', 'cliente', 'revendedor', 'negocio'));

-- 2. Add config_modulos to perfiles
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS config_modulos JSONB DEFAULT '["dashboard", "productos", "ventas", "reportes"]'::jsonb;

-- 3. Add owner_id to data tables for isolation
-- This allows each business to have its own independent inventory and sales.
DO $$ 
BEGIN
    -- Categorias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categorias' AND column_name = 'owner_id') THEN
        ALTER TABLE public.categorias ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Juegos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'juegos' AND column_name = 'owner_id') THEN
        ALTER TABLE public.juegos ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Productos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productos' AND column_name = 'owner_id') THEN
        ALTER TABLE public.productos ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Ventas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventas' AND column_name = 'owner_id') THEN
        ALTER TABLE public.ventas ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Configuracion (Rates)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracion' AND column_name = 'owner_id') THEN
        ALTER TABLE public.configuracion ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Update RLS Policies for Data Isolation
-- Note: owner_id = NULL means "Global System"

-- Categorias
DROP POLICY IF EXISTS "Categorias isolation" ON public.categorias;
CREATE POLICY "Categorias isolation" ON public.categorias
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- Juegos
DROP POLICY IF EXISTS "Juegos isolation" ON public.juegos;
CREATE POLICY "Juegos isolation" ON public.juegos
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- Productos
DROP POLICY IF EXISTS "Productos isolation" ON public.productos;
CREATE POLICY "Productos isolation" ON public.productos
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- Ventas
-- Modified existing policy
DROP POLICY IF EXISTS "Admins see sales" ON public.ventas;
CREATE POLICY "Admins and Negocios see sales" ON public.ventas
FOR ALL USING (
    (
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin'
        AND (
            (SELECT public.is_superadmin()) 
            OR owner_id IS NULL 
            OR owner_id = auth.uid()
        )
    )
    OR
    (
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'negocio'
        AND owner_id = auth.uid()
    )
);

-- Configuracion
DROP POLICY IF EXISTS "Config isolation" ON public.configuracion;
CREATE POLICY "Config isolation" ON public.configuracion
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
