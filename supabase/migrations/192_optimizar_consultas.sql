-- Migración 192: Optimizar consultas para el panel de administración
-- Esta migración crea una vista materializada / vista normal para obtener los datos de clientes completos sin necesidad de 4 consultas.

DROP VIEW IF EXISTS public.v_clientes_admin;

CREATE OR REPLACE VIEW public.v_clientes_admin AS
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
    
    COALESCE(b.saldo, 0) AS saldo,
    COALESCE(b.saldo_bs, 0) AS saldo_bs,
    
    COALESCE(
        (
            SELECT json_agg(ura.rol)
            FROM public.usuario_roles_adicionales ura
            WHERE ura.usuario_id = c.auth_user_id
        ),
        '[]'::json
    ) AS roles_adicionales
FROM public.clientes c
LEFT JOIN public.perfiles p ON p.id = c.auth_user_id
LEFT JOIN public.billeteras b ON b.auth_user_id = c.auth_user_id;

-- Función para que AuthContext cargue el perfil completo rápido
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

-- Otorgar permisos a la vista
GRANT SELECT ON public.v_clientes_admin TO authenticated;
GRANT SELECT ON public.v_clientes_admin TO anon;
