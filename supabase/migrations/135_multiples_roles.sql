-- Migration: 135_multiples_roles.sql
-- Description: Soporte para múltiples roles por usuario, asignables únicamente por administradores.
-- El rol de `perfiles.rol` sigue siendo el "rol principal" (usado por la mayoría de RLS/RPC existentes).
-- Los roles adicionales se guardan en `usuario_roles_adicionales` y se suman a los permisos del usuario.

-- 1. Corregir CHECK de perfiles: 'socio' ya se usaba en el frontend pero no estaba permitido en la BD.
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles
ADD CONSTRAINT perfiles_rol_check
CHECK (rol IN ('admin', 'administrador', 'cliente', 'revendedor', 'negocio', 'empleado', 'trabajador', 'socio'));

-- 2. Tabla de roles adicionales
CREATE TABLE IF NOT EXISTS public.usuario_roles_adicionales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'administrador', 'cliente', 'revendedor', 'negocio', 'empleado', 'trabajador', 'socio')),
    asignado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (usuario_id, rol)
);

ALTER TABLE public.usuario_roles_adicionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roles adicionales: ver propio o admin" ON public.usuario_roles_adicionales;
CREATE POLICY "Roles adicionales: ver propio o admin" ON public.usuario_roles_adicionales
    FOR SELECT USING (
        usuario_id = auth.uid() OR public.is_admin() OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Roles adicionales: gestion admin" ON public.usuario_roles_adicionales;
CREATE POLICY "Roles adicionales: gestion admin" ON public.usuario_roles_adicionales
    FOR ALL USING (
        public.is_admin() OR public.is_superadmin()
    ) WITH CHECK (
        public.is_admin() OR public.is_superadmin()
    );

-- 3. Helper: ¿el usuario actual tiene este rol (principal o adicional)?
CREATE OR REPLACE FUNCTION public.tiene_rol(p_rol TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) = LOWER(p_rol)
  ) OR EXISTS (
    SELECT 1 FROM public.usuario_roles_adicionales WHERE usuario_id = auth.uid() AND LOWER(rol) = LOWER(p_rol)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. is_admin() ahora también considera roles adicionales de staff
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
  ) OR EXISTS (
    SELECT 1 FROM public.usuario_roles_adicionales
    WHERE usuario_id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador', 'empleado', 'trabajador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: obtener todos los roles (principal + adicionales) de un usuario
CREATE OR REPLACE FUNCTION public.obtener_roles_usuario(p_user_id UUID DEFAULT NULL)
RETURNS TEXT[] AS $$
DECLARE
    v_target UUID := COALESCE(p_user_id, auth.uid());
    v_roles TEXT[];
BEGIN
    IF v_target <> auth.uid() AND NOT public.is_admin() AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'No tienes permiso para ver los roles de este usuario.';
    END IF;

    SELECT ARRAY(
        SELECT DISTINCT rol FROM (
            SELECT LOWER(rol) AS rol FROM public.perfiles WHERE id = v_target
            UNION
            SELECT LOWER(rol) AS rol FROM public.usuario_roles_adicionales WHERE usuario_id = v_target
        ) t
        WHERE rol IS NOT NULL
    ) INTO v_roles;

    RETURN v_roles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: reemplazar el conjunto de roles adicionales de un usuario (solo admins)
CREATE OR REPLACE FUNCTION public.admin_set_roles_adicionales(p_user_id UUID, p_roles TEXT[])
RETURNS JSONB AS $$
DECLARE
    v_rol_principal TEXT;
BEGIN
    IF NOT public.is_admin() AND NOT public.is_superadmin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos para gestionar roles.');
    END IF;

    SELECT LOWER(rol) INTO v_rol_principal FROM public.perfiles WHERE id = p_user_id;

    DELETE FROM public.usuario_roles_adicionales WHERE usuario_id = p_user_id;

    INSERT INTO public.usuario_roles_adicionales (usuario_id, rol, asignado_por)
    SELECT p_user_id, LOWER(r), auth.uid()
    FROM unnest(COALESCE(p_roles, ARRAY[]::TEXT[])) r
    WHERE LOWER(r) IS DISTINCT FROM v_rol_principal
    ON CONFLICT (usuario_id, rol) DO NOTHING;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Actualizar políticas RLS para que reconozcan roles adicionales

-- Categorias
DROP POLICY IF EXISTS "Categorias isolation" ON public.categorias;
CREATE POLICY "Categorias isolation" ON public.categorias
FOR ALL USING (
    (owner_id IS NULL AND (
        public.tiene_rol('admin') OR public.tiene_rol('cliente') OR public.tiene_rol('revendedor')
        OR public.tiene_rol('empleado') OR public.tiene_rol('trabajador')
    ))
    OR (owner_id = auth.uid())
    OR public.is_admin()
);

-- Juegos
DROP POLICY IF EXISTS "Juegos isolation" ON public.juegos;
CREATE POLICY "Juegos isolation" ON public.juegos
FOR ALL USING (
    (owner_id IS NULL AND (
        public.tiene_rol('admin') OR public.tiene_rol('cliente') OR public.tiene_rol('revendedor')
        OR public.tiene_rol('empleado') OR public.tiene_rol('trabajador')
    ))
    OR (owner_id = auth.uid())
    OR public.is_admin()
);

-- Productos
DROP POLICY IF EXISTS "Productos isolation" ON public.productos;
CREATE POLICY "Productos isolation" ON public.productos
FOR ALL USING (
    (owner_id IS NULL AND (
        public.tiene_rol('admin') OR public.tiene_rol('cliente') OR public.tiene_rol('revendedor')
        OR public.tiene_rol('empleado') OR public.tiene_rol('trabajador')
    ))
    OR (owner_id = auth.uid())
    OR public.is_admin()
);

-- Configuracion
DROP POLICY IF EXISTS "Config isolation" ON public.configuracion;
CREATE POLICY "Config isolation" ON public.configuracion
FOR ALL USING (
    (owner_id IS NULL AND (
        public.tiene_rol('admin') OR public.tiene_rol('cliente') OR public.tiene_rol('revendedor')
        OR public.tiene_rol('empleado') OR public.tiene_rol('trabajador')
    ))
    OR (owner_id = auth.uid())
    OR public.is_admin()
);

-- Ventas
DROP POLICY IF EXISTS "Admins and Negocios see sales" ON public.ventas;
DROP POLICY IF EXISTS "Admins, Negocios and Empleados see sales" ON public.ventas;
CREATE POLICY "Admins, Negocios and Empleados see sales" ON public.ventas
FOR ALL USING (
    (
        public.is_admin()
        AND (
            public.is_superadmin()
            OR owner_id IS NULL
            OR owner_id = auth.uid()
        )
    )
    OR
    (
        public.tiene_rol('negocio')
        AND owner_id = auth.uid()
    )
);

-- 8. Recargar esquema
NOTIFY pgrst, 'reload schema';
