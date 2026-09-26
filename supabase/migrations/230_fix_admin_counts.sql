CREATE OR REPLACE FUNCTION public.get_admin_counts_rpc(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_owner_id UUID;
    v_pedidos_verificando INT;
    v_pedidos_pendientes INT;
    v_pedidos_reembolso INT;
    v_recargas_pendientes INT;
    v_mensajes_soporte INT;
BEGIN
    -- Determinar si es admin por el rol (admin o empleado pueden ver todos los pedidos)
    SELECT (rol ILIKE 'admin' OR rol ILIKE 'administrador' OR rol ILIKE 'empleado') INTO v_is_admin
    FROM public.perfiles
    WHERE id = p_user_id
    LIMIT 1;

    -- También validar por email por si acaso es el owner original (fallback)
    IF NOT COALESCE(v_is_admin, false) THEN
        SELECT (usuario = 'recargashulk@gmail.com') INTO v_is_admin
        FROM public.clientes
        WHERE auth_user_id = p_user_id
        LIMIT 1;
    END IF;

    -- Obtener owner_id (id del cliente asociado) para las consultas limitadas
    SELECT id INTO v_owner_id
    FROM public.clientes
    WHERE auth_user_id = p_user_id
    LIMIT 1;

    -- Si no es admin y no tiene owner_id, usar ID de seguridad
    IF NOT COALESCE(v_is_admin, false) AND v_owner_id IS NULL THEN
        v_owner_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    -- 1. Pedidos Verificando
    IF v_is_admin THEN
        SELECT COUNT(*) INTO v_pedidos_verificando FROM public.pedidos 
        WHERE pago_verificado IS NULL AND estado NOT IN ('cancelado', 'reembolsado', 'completado');
    ELSE
        SELECT COUNT(*) INTO v_pedidos_verificando FROM public.pedidos 
        WHERE pago_verificado IS NULL AND estado NOT IN ('cancelado', 'reembolsado', 'completado') AND owner_id = v_owner_id;
    END IF;

    -- 2. Pedidos Pendientes
    IF v_is_admin THEN
        SELECT COUNT(*) INTO v_pedidos_pendientes FROM public.pedidos 
        WHERE estado IN ('pendiente', 'procesando');
    ELSE
        SELECT COUNT(*) INTO v_pedidos_pendientes FROM public.pedidos 
        WHERE estado IN ('pendiente', 'procesando') AND owner_id = v_owner_id;
    END IF;

    -- 3. Pedidos Reembolso / Observación (Recargas de Pedidos)
    IF v_is_admin THEN
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
    WHERE sm.leido = false
      AND sm.remitente_id NOT IN (
          SELECT c.id 
          FROM public.clientes c
          JOIN public.perfiles p ON p.id = c.auth_user_id
          WHERE p.rol ILIKE 'admin' OR p.rol ILIKE 'administrador'
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
