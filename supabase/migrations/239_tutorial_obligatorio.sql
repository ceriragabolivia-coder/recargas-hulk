-- 239_tutorial_obligatorio.sql

-- 1. Añadir columna a perfiles
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS tutorial_obligatorio_visto BOOLEAN DEFAULT FALSE;

-- 2. Añadir configuraciones si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'tutorial_obligatorio_activo' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('tutorial_obligatorio_activo', 0, 'Activar video tutorial obligatorio', 'false', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'tutorial_obligatorio_url' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('tutorial_obligatorio_url', 0, 'URL del video tutorial obligatorio', '', NULL);
    END IF;
END $$;

-- 3. Actualizar la vista v_clientes_admin para que devuelva tutorial_obligatorio_visto
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
    
    COALESCE(b.saldo, 0) AS saldo,
    COALESCE(b.saldo_bs, 0) AS saldo_bs,
    
    COALESCE(ra.roles_adicionales, '[]'::json) AS roles_adicionales

FROM public.clientes c
LEFT JOIN public.perfiles p ON p.id = c.auth_user_id
LEFT JOIN public.billeteras b ON b.auth_user_id = c.auth_user_id
LEFT JOIN roles_agg ra ON ra.usuario_id = c.auth_user_id;

-- 4. Recrear la función dependiente
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

GRANT SELECT ON public.v_clientes_admin TO authenticated;
GRANT SELECT ON public.v_clientes_admin TO anon;

-- 5. RPC para marcar como visto
CREATE OR REPLACE FUNCTION public.marcar_tutorial_visto_rpc(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE public.perfiles
    SET tutorial_obligatorio_visto = TRUE
    WHERE id = p_user_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
