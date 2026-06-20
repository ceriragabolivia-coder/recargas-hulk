-- Migration: 105_empleado_role_support.sql
-- Description: Add 'empleado' and 'trabajador' roles, update functions and RLS policies.

-- 1. Update roles check constraint in perfiles
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_rol_check 
CHECK (rol IN ('admin', 'administrador', 'cliente', 'revendedor', 'negocio', 'empleado', 'trabajador'));

-- 2. Update is_admin() function to include staff roles (for basic read access)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() 
    AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update admin_approve_user RPC to allow employees to approve users
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id UUID, p_status TEXT)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Verificar si el que llama es admin o empleado
    SELECT LOWER(rol) INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
    
    IF v_caller_role NOT IN ('admin', 'administrador', 'empleado', 'trabajador') AND NOT public.is_superadmin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos para realizar esta acción');
    END IF;

    -- 1. Actualizar o Insertar en perfiles
    INSERT INTO public.perfiles (id, estado, rol, updated_at)
    VALUES (p_user_id, p_status, 'cliente', now())
    ON CONFLICT (id) DO UPDATE 
    SET estado = EXCLUDED.estado, updated_at = now();

    -- 2. Actualizar en clientes
    UPDATE public.clientes 
    SET estado = p_status 
    WHERE auth_user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Usuario actualizado correctamente a ' || p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update RLS Policies for data visibility
-- Categorias
DROP POLICY IF EXISTS "Categorias isolation" ON public.categorias;
CREATE POLICY "Categorias isolation" ON public.categorias
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor', 'empleado', 'trabajador'))
    OR (owner_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'empleado', 'trabajador')))
);

-- Juegos
DROP POLICY IF EXISTS "Juegos isolation" ON public.juegos;
CREATE POLICY "Juegos isolation" ON public.juegos
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor', 'empleado', 'trabajador'))
    OR (owner_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'empleado', 'trabajador')))
);

-- Productos
DROP POLICY IF EXISTS "Productos isolation" ON public.productos;
CREATE POLICY "Productos isolation" ON public.productos
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor', 'empleado', 'trabajador'))
    OR (owner_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'empleado', 'trabajador')))
);

-- Ventas
DROP POLICY IF EXISTS "Admins and Negocios see sales" ON public.ventas;
DROP POLICY IF EXISTS "Admins, Negocios and Empleados see sales" ON public.ventas;
CREATE POLICY "Admins, Negocios and Empleados see sales" ON public.ventas
FOR ALL USING (
    (
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()) IN ('admin', 'empleado', 'trabajador')
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
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor', 'empleado', 'trabajador'))
    OR (owner_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'empleado', 'trabajador')))
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
