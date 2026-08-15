-- Migration: 218_auto_approve_recargas_on_apk.sql
-- Description: Actualiza el trigger en pagos_apk para que también auto-apruebe billetera_recargas si el SMS llega después de que el usuario creó la solicitud de recarga.

CREATE OR REPLACE FUNCTION public.fn_auto_verify_apk_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_pedido RECORD;
    v_recarga RECORD;
    v_amount_to_check NUMERIC;
BEGIN
    -- Solo procesar si el estado es 'disponible' (nuevo)
    IF NEW.status = 'disponible' THEN
        -- 1. Intentar hacer match con PEDIDOS
        SELECT * INTO v_pedido 
        FROM public.pedidos 
        WHERE (referencia_pago = NEW.referencia OR referencia_pago LIKE NEW.referencia || ' |%')
        AND estado = 'pendiente'
        AND pago_verificado IS NULL
        ORDER BY created_at DESC LIMIT 1;
        
        IF FOUND THEN
            -- Determinar el monto que debió pagar el usuario (prioriza monto_restante_bs)
            v_amount_to_check := COALESCE(v_pedido.monto_restante_bs, v_pedido.total_bs);
            
            -- Verificar si el monto coincide con una tolerancia de 0.05
            IF ABS(NEW.monto - v_amount_to_check) <= 0.05 THEN
                -- Marcar pago como verificado
                UPDATE public.pedidos 
                SET pago_verificado = true, updated_at = NOW() 
                WHERE id = v_pedido.id;
                
                -- Marcar el pago APK como usado
                NEW.status := 'usado';
                NEW.pedido_id := v_pedido.id;
                NEW.usuario_id := v_pedido.cliente_id;
                
                RETURN NEW; -- Salir, ya se procesó como pedido
            END IF;
        END IF;

        -- 2. Intentar hacer match con BILLETERA_RECARGAS (Si no es pedido, puede ser recarga)
        SELECT * INTO v_recarga 
        FROM public.billetera_recargas 
        WHERE referencia_pago = NEW.referencia
        AND estado = 'pendiente'
        ORDER BY created_at DESC LIMIT 1;

        IF FOUND THEN
            -- Verificar si el monto coincide con una tolerancia de 2.0 Bs (igual que intentar_auto_aprobar_recarga_rpc)
            IF ABS(NEW.monto - v_recarga.monto) <= 2.0 THEN
                -- Marcar la recarga como aprobada
                UPDATE public.billetera_recargas 
                SET estado = 'aprobado', updated_at = NOW() 
                WHERE id = v_recarga.id;

                -- Crear la transacción en la billetera
                INSERT INTO public.billetera_transacciones (
                    auth_user_id,
                    tipo,
                    monto,
                    moneda,
                    descripcion,
                    referencia_id
                ) VALUES (
                    v_recarga.auth_user_id,
                    'recarga',
                    v_recarga.monto,
                    v_recarga.moneda,
                    'Recarga de saldo automática',
                    v_recarga.id
                );

                -- Actualizar el saldo del usuario
                IF v_recarga.moneda = 'usd' THEN
                    UPDATE public.billeteras 
                    SET saldo = saldo + v_recarga.monto, updated_at = NOW() 
                    WHERE auth_user_id = v_recarga.auth_user_id;
                ELSE
                    UPDATE public.billeteras 
                    SET saldo_bs = saldo_bs + v_recarga.monto, updated_at = NOW() 
                    WHERE auth_user_id = v_recarga.auth_user_id;
                END IF;

                -- Marcar el pago APK como usado
                NEW.status := 'usado';
                NEW.usuario_id := v_recarga.auth_user_id;
                -- pedido_id se queda nulo porque es una recarga
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
