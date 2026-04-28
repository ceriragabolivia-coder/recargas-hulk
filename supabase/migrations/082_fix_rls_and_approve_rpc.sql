
-- Migración 082: RPC de Aprobación y Corrección de RLS
-- Esta migración soluciona el error 403 al aprobar usuarios mediante una función segura (RPC)
-- y corrige las políticas RLS para que usen funciones SECURITY DEFINER.

-- 1. Función RPC para aprobación/rechazo de usuarios (Segura y Directa)
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id UUID, p_status TEXT)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Verificar si el que llama es admin
    SELECT LOWER(rol) INTO v_caller_role FROM public.perfiles WHERE id = auth.uid();
    
    IF v_caller_role NOT IN ('admin', 'administrador') AND NOT public.is_superadmin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos de administrador');
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

-- 2. Corregir políticas RLS de perfiles (Usar funciones SECURITY DEFINER en lugar de subconsultas directas a auth.users)
DROP POLICY IF EXISTS "Perfiles: SuperAdmin bypass" ON public.perfiles;
CREATE POLICY "Perfiles: SuperAdmin bypass" 
ON public.perfiles FOR ALL 
TO authenticated 
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- 3. Asegurar que las otras políticas admin también sean robustas
DROP POLICY IF EXISTS "Perfiles: admin select" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin insert" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin update" ON public.perfiles;
DROP POLICY IF EXISTS "Perfiles: admin delete" ON public.perfiles;

CREATE POLICY "Perfiles: admin select" ON public.perfiles FOR SELECT TO authenticated USING (public.is_admin() OR public.is_superadmin());
CREATE POLICY "Perfiles: admin insert" ON public.perfiles FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "Perfiles: admin update" ON public.perfiles FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_superadmin()) WITH CHECK (public.is_admin() OR public.is_superadmin());
CREATE POLICY "Perfiles: admin delete" ON public.perfiles FOR DELETE TO authenticated USING (public.is_admin() OR public.is_superadmin());

-- 4. Recargar esquema
NOTIFY pgrst, 'reload schema';
