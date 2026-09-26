-- Migración 229: RPC para consolidar conteos del panel de administración y reducir latencia de red

CREATE OR REPLACE FUNCTION public.get_admin_counts_rpc(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_is_superadmin BOOLEAN;
    v_owner_id UUID;
    v_pedidos_verificando INT;
    v_pedidos_pendientes INT;
    v_pedidos_reembolso INT;
    v_recargas_pendientes INT;
    v_mensajes_soporte INT;
BEGIN
    -- Determinar si es superadmin
    SELECT (usuario = 'recargashulk@gmail.com') INTO v_is_superadmin
    FROM public.clientes
    WHERE auth_user_id = p_user_id
    LIMIT 1;

    -- Obtener owner_id (id del cliente asociado)
    SELECT id INTO v_owner_id
    FROM public.clientes
    WHERE auth_user_id = p_user_id
    LIMIT 1;

    -- Si no es superadmin y no tiene owner_id, usar ID de seguridad
    IF NOT COALESCE(v_is_superadmin, false) AND v_owner_id IS NULL THEN
        v_owner_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    -- 1. Pedidos Verificando
    IF v_is_superadmin THEN
        SELECT COUNT(*) INTO v_pedidos_verificando FROM public.pedidos 
        WHERE pago_verificado IS NULL AND estado NOT IN ('cancelado', 'reembolsado', 'completado');
    ELSE
        SELECT COUNT(*) INTO v_pedidos_verificando FROM public.pedidos 
        WHERE pago_verificado IS NULL AND estado NOT IN ('cancelado', 'reembolsado', 'completado') AND owner_id = v_owner_id;
    END IF;

    -- 2. Pedidos Pendientes
    IF v_is_superadmin THEN
        SELECT COUNT(*) INTO v_pedidos_pendientes FROM public.pedidos 
        WHERE estado = 'pendiente';
    ELSE
        SELECT COUNT(*) INTO v_pedidos_pendientes FROM public.pedidos 
        WHERE estado = 'pendiente' AND owner_id = v_owner_id;
    END IF;

    -- 3. Pedidos Reembolso / Observación
    IF v_is_superadmin THEN
        SELECT COUNT(*) INTO v_pedidos_reembolso FROM public.pedidos 
        WHERE pago_verificado = true AND estado NOT IN ('completado', 'cancelado', 'reembolsado');
    ELSE
        SELECT COUNT(*) INTO v_pedidos_reembolso FROM public.pedidos 
        WHERE pago_verificado = true AND estado NOT IN ('completado', 'cancelado', 'reembolsado') AND owner_id = v_owner_id;
    END IF;

    -- 4. Recargas Billetera Pendientes (Global)
    SELECT COUNT(*) INTO v_recargas_pendientes FROM public.billetera_recargas 
    WHERE estado = 'pendiente';

    -- 5. Mensajes Soporte No Leídos (Excluir los de admins)
    SELECT COUNT(*) INTO v_mensajes_soporte
    FROM public.soporte_mensajes sm
    WHERE sm.leido_admin = false
      AND sm.sender_id NOT IN (
          SELECT c.id 
          FROM public.clientes c
          JOIN public.perfiles p ON p.id = c.auth_user_id
          WHERE p.rol ILIKE 'admin'
      );

    RETURN json_build_object(
        'pedidos_verificando', COALESCE(v_pedidos_verificando, 0),
        'pedidos_pendientes', COALESCE(v_pedidos_pendientes, 0),
        'pedidos_reembolso', COALESCE(v_pedidos_reembolso, 0),
        'recargas_pendientes', COALESCE(v_recargas_pendientes, 0),
        'mensajes_soporte', COALESCE(v_mensajes_soporte, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
