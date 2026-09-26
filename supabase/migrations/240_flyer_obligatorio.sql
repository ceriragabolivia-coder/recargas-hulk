-- Migración 240: Sistema de Flyers Obligatorios (Avisos)

-- 1. Añadir columna a perfiles para saber la última versión del flyer que vio el usuario
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS flyer_visto_version INT DEFAULT 0;

-- 2. Modificar la vista para incluir este nuevo campo
DROP VIEW IF EXISTS public.v_clientes_admin CASCADE;

CREATE OR REPLACE VIEW public.v_clientes_admin AS
WITH roles_agg AS (
    SELECT usuario_id, json_agg(rol) AS roles_adicionales
    FROM public.usuario_roles_adicionales
    GROUP BY usuario_id
)
SELECT
    c.id AS cliente_id,
    c.auth_user_id,
    c.nombres,
    c.apellidos,
    c.usuario,
    c.nickname,
    c.whatsapp,
    c.fecha_registro,
    c.fecha_nacimiento,
    c.genero,
    c.instagram_link,
    c.facebook_link,
    c.juegos_favoritos,
    c.avatar_url,
    
    p.rol AS rol,
    COALESCE(p.estado, c.estado, 'pendiente') AS estado,
    COALESCE(p.porcentaje_descuento, 0) AS porcentaje_descuento,
    COALESCE(p.config_modulos, '[]'::jsonb) AS config_modulos,
    p.motivo_estado,
    COALESCE(p.juegos_deshabilitados, '[]'::jsonb) AS juegos_deshabilitados,
    COALESCE(p.tutorial_obligatorio_visto, FALSE) AS tutorial_obligatorio_visto,
    COALESCE(p.flyer_visto_version, 0) AS flyer_visto_version,
    
    COALESCE(b.saldo, 0) AS saldo,
    COALESCE(b.saldo_bs, 0) AS saldo_bs,
    
    COALESCE(ra.roles_adicionales, '[]'::json) AS roles_adicionales

FROM public.clientes c
LEFT JOIN public.perfiles p ON p.id = c.auth_user_id
LEFT JOIN public.billeteras b ON b.auth_user_id = c.auth_user_id
LEFT JOIN roles_agg ra ON ra.usuario_id = c.auth_user_id;

-- 3. Recrear el RPC
CREATE OR REPLACE FUNCTION public.get_perfil_completo_rpc(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT row_to_json(v.*) INTO v_result
    FROM public.v_clientes_admin v
    WHERE v.auth_user_id = p_user_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_perfil_completo_rpc(UUID) OWNER TO postgres;

GRANT SELECT ON public.v_clientes_admin TO authenticated;
GRANT SELECT ON public.v_clientes_admin TO anon;

-- 4. Función para que el cliente marque el flyer como visto
CREATE OR REPLACE FUNCTION public.marcar_flyer_visto_rpc(p_user_id UUID, p_version INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se inserta o actualiza el registro en perfiles
    INSERT INTO public.perfiles (id, auth_user_id, flyer_visto_version)
    VALUES (p_user_id, p_user_id, p_version)
    ON CONFLICT (id) DO UPDATE SET flyer_visto_version = EXCLUDED.flyer_visto_version;
END;
$$;

ALTER FUNCTION public.marcar_flyer_visto_rpc(UUID, INT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.marcar_flyer_visto_rpc(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_flyer_visto_rpc(UUID, INT) TO anon;
