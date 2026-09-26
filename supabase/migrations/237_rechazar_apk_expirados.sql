-- Migration: 237_rechazar_apk_expirados.sql
-- Description: RPC para rechazar automáticamente pedidos y recargas pendientes con métodos Pago Móvil/Transferencia que tengan más de 2 minutos y no se hayan auto-verificado por falta del SMS en Pagos APK.

CREATE OR REPLACE FUNCTION public.rechazar_pagos_apk_expirados_rpc()
RETURNS JSONB AS $$
DECLARE
    v_pedidos_rechazados INT := 0;
    v_recargas_rechazadas INT := 0;
    v_record RECORD;
BEGIN
    -- ==========================================
    -- 1. PROCESAR PEDIDOS EXPIRADOS (10 SEGUNDOS)
    -- ==========================================
    FOR v_record IN 
        SELECT p.id, p.cliente_id, p.referencia_pago, p.numero_pedido
        FROM public.pedidos p
        JOIN public.metodos_pago m ON p.metodo_pago_id = m.id
        WHERE p.estado = 'pendiente'
          AND p.pago_verificado IS NOT TRUE
          AND p.referencia_pago IS NOT NULL 
          AND p.referencia_pago != '' 
          AND p.referencia_pago != 'N/A'
          AND p.referencia_pago NOT LIKE 'PAGO_BILLETERA%'
          AND (m.habilitado_billetera_bs = true OR m.nombre ILIKE '%pago móvil%' OR m.nombre ILIKE '%transferencia%')
          AND p.created_at < (NOW() - INTERVAL '10 seconds')
    LOOP
        -- Rechazar el pedido
        UPDATE public.pedidos 
        SET estado = 'rechazado', pago_verificado = false, updated_at = NOW() 
        WHERE id = v_record.id;

        -- Notificar al usuario
        INSERT INTO public.notificaciones_usuarios (user_id, titulo, mensaje, tipo, leido)
        VALUES (
            v_record.cliente_id, 
            'Pago Rechazado',
            'Tu pedido #' || v_record.numero_pedido || ' fue rechazado porque no encontramos tu referencia de pago en nuestra base de datos. Por favor, verifica los números e intenta de nuevo.',
            'pedido_rechazado',
            false
        );

        -- Eliminar la referencia de la tabla de control (para no pasarla a lista negra)
        DELETE FROM public.referencias_pagos_control 
        WHERE origen = 'pedido' AND referencia = v_record.referencia_pago;

        v_pedidos_rechazados := v_pedidos_rechazados + 1;
    END LOOP;


    -- ==========================================
    -- 2. PROCESAR RECARGAS DE BILLETERA EXPIRADAS (10 SEGUNDOS)
    -- ==========================================
    FOR v_record IN 
        SELECT r.id, r.auth_user_id, r.referencia_pago
        FROM public.billetera_recargas r
        JOIN public.metodos_pago m ON r.metodo_pago_id = m.id
        WHERE r.estado = 'pendiente'
          AND r.referencia_pago IS NOT NULL 
          AND r.referencia_pago != ''
          AND (m.habilitado_billetera_bs = true OR m.nombre ILIKE '%pago móvil%' OR m.nombre ILIKE '%transferencia%')
          AND r.created_at < (NOW() - INTERVAL '10 seconds')
    LOOP
        -- Rechazar la recarga
        UPDATE public.billetera_recargas 
        SET estado = 'rechazado', pago_verificado = false, updated_at = NOW() 
        WHERE id = v_record.id;

        -- Notificar al usuario
        INSERT INTO public.notificaciones_usuarios (user_id, titulo, mensaje, tipo, leido)
        VALUES (
            v_record.auth_user_id, 
            'Recarga Rechazada',
            'Tu recarga de saldo fue rechazada porque no encontramos tu referencia de pago en nuestra base de datos. Por favor, verifica los números e intenta de nuevo.',
            'recarga_rechazada',
            false
        );

        -- Eliminar la referencia de la tabla de control (para no pasarla a lista negra)
        DELETE FROM public.referencias_pagos_control 
        WHERE origen = 'billetera' AND referencia = v_record.referencia_pago;

        v_recargas_rechazadas := v_recargas_rechazadas + 1;
    END LOOP;

    -- Notificar para recargar la UI
    IF v_pedidos_rechazados > 0 OR v_recargas_rechazadas > 0 THEN
        NOTIFY pgrst, 'reload schema';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pedidos_rechazados', v_pedidos_rechazados,
        'recargas_rechazadas', v_recargas_rechazadas
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
GRANT EXECUTE ON FUNCTION public.rechazar_pagos_apk_expirados_rpc() TO authenticated, anon;

-- Reload cache so API can see the new function immediately
NOTIFY pgrst, 'reload schema';
