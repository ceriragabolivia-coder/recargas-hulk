-- 222_rpc_recompensa_referido.sql
CREATE OR REPLACE FUNCTION reclamar_recompensa_referido(p_cliente_id uuid, p_objetivo_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_objetivo RECORD;
    v_validos INT;
    v_ya_canjeado BOOLEAN;
    v_billetera_id UUID;
    v_auth_user_id UUID;
BEGIN
    -- 1. Obtener objetivo
    SELECT * INTO v_objetivo FROM public.referidos_objetivos WHERE id = p_objetivo_id AND estado = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El objetivo no existe o no está activo.';
    END IF;

    -- 2. Verificar si ya fue canjeado
    SELECT EXISTS(
        SELECT 1 FROM public.referidos_recompensas_canjeadas 
        WHERE cliente_id = p_cliente_id AND objetivo_id = p_objetivo_id
    ) INTO v_ya_canjeado;
    
    IF v_ya_canjeado THEN
        RAISE EXCEPTION 'Ya has reclamado esta recompensa anteriormente.';
    END IF;

    -- 3. Calcular progreso (Referidos válidos)
    SELECT COUNT(*) INTO v_validos 
    FROM public.clientes c
    WHERE c.referido_por_cliente_id = p_cliente_id
      AND (
          SELECT COUNT(*) 
          FROM public.pedidos p 
          WHERE p.cliente_id = c.id AND p.estado = 'completado'
      ) >= v_objetivo.compras_minimas_usuario;

    IF v_validos < v_objetivo.meta_registros_activos THEN
        RAISE EXCEPTION 'Aún no cumples con el objetivo de referidos válidos.';
    END IF;

    -- 4. Registrar canje para evitar duplicados
    INSERT INTO public.referidos_recompensas_canjeadas (cliente_id, objetivo_id)
    VALUES (p_cliente_id, p_objetivo_id);

    -- 5. Obtener el auth_user_id del cliente referidor
    SELECT auth_user_id INTO v_auth_user_id FROM public.clientes WHERE id = p_cliente_id;

    -- 6. Entregar premio
    IF v_objetivo.recompensa_tipo = 'saldo_bs' OR v_objetivo.recompensa_tipo = 'saldo_usd' THEN
        -- Obtener o crear billetera
        SELECT id INTO v_billetera_id FROM public.billeteras WHERE cliente_id = p_cliente_id;
        IF v_billetera_id IS NULL THEN
            INSERT INTO public.billeteras (cliente_id) VALUES (p_cliente_id) RETURNING id INTO v_billetera_id;
        END IF;

        IF v_objetivo.recompensa_tipo = 'saldo_bs' THEN
            UPDATE public.billeteras SET saldo = saldo + v_objetivo.recompensa_valor WHERE id = v_billetera_id;
        ELSE
            UPDATE public.billeteras SET saldo_usd = saldo_usd + v_objetivo.recompensa_valor WHERE id = v_billetera_id;
        END IF;

        -- Registrar transacción de billetera
        INSERT INTO public.billetera_transacciones (billetera_id, monto, tipo, descripcion, tipo_moneda, referencia)
        VALUES (
            v_billetera_id, 
            v_objetivo.recompensa_valor, 
            'ingreso', 
            'Recompensa de Sistema de Referidos (Objetivo ' || v_objetivo.meta_registros_activos || ' referidos)', 
            CASE WHEN v_objetivo.recompensa_tipo = 'saldo_bs' THEN 'BS' ELSE 'USD' END,
            'REF_OBJ_' || substring(p_objetivo_id::text from 1 for 6)
        );
        
    ELSIF v_objetivo.recompensa_tipo = 'producto' THEN
        -- Dar una recarga o cupón, aquí agregaremos saldo o lo manejaremos desde el admin
        -- Por ahora podemos añadir un registro manual para que el admin lo procese, o crear un pedido pendiente.
        -- Para simplificar, añadimos una notificación al usuario de que comunique al soporte para recibir su producto.
        INSERT INTO public.notificaciones_usuarios (usuario_id, titulo, mensaje)
        VALUES (
            v_auth_user_id,
            'Premio de Referidos',
            '¡Felicidades! Has desbloqueado un producto especial por tus referidos. Contacta a soporte indicando tu logro para reclamarlo.'
        );
    END IF;

    -- 7. Notificar éxito al usuario
    INSERT INTO public.notificaciones_usuarios (usuario_id, titulo, mensaje)
    VALUES (
        v_auth_user_id,
        '¡Recompensa Reclamada!',
        'Has reclamado exitosamente tu premio por invitar a ' || v_objetivo.meta_registros_activos || ' amigos. ¡Sigue así!'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Recompensa entregada exitosamente.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
