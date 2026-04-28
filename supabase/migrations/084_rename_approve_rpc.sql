
-- Migración 084: Función de Aprobación con Nuevo Nombre (Bypass Cache)
-- Cambiamos el nombre de la función para forzar a PostgREST a reconocerla como nueva.

DROP FUNCTION IF EXISTS public.rpc_aprobar_usuario(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_aprobar_usuario(p_user_id UUID, p_status TEXT)
RETURNS JSONB AS $$
BEGIN
    -- Bypass total para SuperAdmin o verificación de Admin
    IF NOT public.is_superadmin() THEN
        IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND LOWER(rol) IN ('admin', 'administrador')) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Permiso denegado');
        END IF;
    END IF;

    -- Actualización de estado en ambas tablas
    INSERT INTO public.perfiles (id, estado, rol, updated_at)
    VALUES (p_user_id, p_status, 'cliente', now())
    ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, updated_at = now();

    UPDATE public.clientes SET estado = p_status WHERE auth_user_id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
