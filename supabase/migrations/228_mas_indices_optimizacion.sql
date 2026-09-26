-- Migración 228: Más índices y optimización de vista para corregir lentitud del Admin

-- 1. Índices para la tabla 'pedidos' que causan escaneos secuenciales en Layout.jsx (fetchCounts)
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_pago_verificado ON public.pedidos(pago_verificado);
CREATE INDEX IF NOT EXISTS idx_pedidos_owner_id ON public.pedidos(owner_id);

-- 2. Índices para la tabla 'billetera_recargas' (fetchCounts)
CREATE INDEX IF NOT EXISTS idx_billetera_recargas_estado ON public.billetera_recargas(estado);

-- 3. Optimización extrema de la vista v_clientes_admin usando joins en lugar de subconsultas correlacionadas
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
    
    COALESCE(b.saldo, 0) AS saldo,
    COALESCE(b.saldo_bs, 0) AS saldo_bs,
    
    COALESCE(ra.roles_adicionales, '[]'::json) AS roles_adicionales

FROM public.clientes c
LEFT JOIN public.perfiles p ON p.id = c.auth_user_id
LEFT JOIN public.billeteras b ON b.auth_user_id = c.auth_user_id
LEFT JOIN roles_agg ra ON ra.usuario_id = c.auth_user_id;

-- Recrear la función que dependía de la vista (se borró por CASCADE)
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

-- Actualizar estadísticas de PostgreSQL para que utilice los nuevos índices de los pedidos
ANALYZE public.pedidos;
ANALYZE public.billetera_recargas;
