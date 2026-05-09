-- Migration 102: Corregir lógica de moneda en saldos operativos de administradores
-- Asegura que solo se acredite la moneda correspondiente al método de pago del pedido.

CREATE OR REPLACE FUNCTION public.trig_act_saldos_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_is_bs BOOLEAN := false;
    v_metodo_pago RECORD;
    v_monto NUMERIC;
    v_moneda TEXT;
BEGIN
    -- 1. Determinar si el pago fue en Bolívares (Bs) o USD
    -- Basado en la referencia de pago (texto)
    IF NEW.referencia_pago ILIKE '%billetera bs%' 
       OR NEW.referencia_pago ILIKE '%pago móvil%' 
       OR NEW.referencia_pago ILIKE '%pago movil%' 
       OR NEW.referencia_pago ILIKE '%bolívares%' 
       OR NEW.referencia_pago ILIKE '%bs%' 
    THEN
        v_is_bs := true;
    -- O basado en el método de pago configurado
    ELSIF NEW.metodo_pago_id IS NOT NULL THEN
        SELECT nombre, habilitado_billetera_bs INTO v_metodo_pago FROM public.metodos_pago WHERE id = NEW.metodo_pago_id;
        IF v_metodo_pago.habilitado_billetera_bs = true 
           OR v_metodo_pago.nombre ILIKE '%pago%' 
           OR v_metodo_pago.nombre ILIKE '%bs%' 
           OR v_metodo_pago.nombre ILIKE '%bolívares%' 
        THEN
            v_is_bs := true;
        END IF;
    END IF;

    -- 2. Asignar moneda y monto
    IF v_is_bs THEN
        v_moneda := 'bs';
        v_monto := COALESCE(NEW.total_bs, 0);
    ELSE
        v_moneda := 'usd';
        v_monto := COALESCE(NEW.total_usd, 0);
    END IF;

    -- 3. CASO: Pedido pasa a 'completado' -> Acreditar Saldo
    IF NEW.estado = 'completado' AND (TG_OP = 'INSERT' OR OLD.estado != 'completado') THEN
        IF NEW.atendido_por_id IS NOT NULL THEN
            
            -- Actualizar o insertar el saldo del admin (solo la moneda que corresponde)
            INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, saldo_bs, updated_at)
            VALUES (
                NEW.atendido_por_id, 
                CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END, 
                CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END, 
                now()
            )
            ON CONFLICT (auth_user_id) 
            DO UPDATE SET 
                saldo_usd = public.admin_saldos.saldo_usd + (CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END),
                saldo_bs = public.admin_saldos.saldo_bs + (CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END),
                updated_at = now();

            -- Registrar en el historial
            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (
                NEW.atendido_por_id, 
                NEW.id, 
                'credito_venta', 
                v_moneda, 
                v_monto, 
                'Crédito automático ' || UPPER(v_moneda) || ' Pedido #' || NEW.numero_pedido
            );
        END IF;

    -- 4. CASO: Pedido deja de ser 'completado' -> Revertir Saldo
    ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'completado' AND NEW.estado != 'completado' THEN
        IF OLD.atendido_por_id IS NOT NULL THEN
            
            -- Restar el saldo (solo la moneda que correspondía)
            UPDATE public.admin_saldos
            SET saldo_usd = saldo_usd - (CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END),
                saldo_bs = saldo_bs - (CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END),
                updated_at = now()
            WHERE auth_user_id = OLD.atendido_por_id;

            -- Registrar en el historial
            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (
                OLD.atendido_por_id, 
                OLD.id, 
                'reverso_venta', 
                v_moneda, 
                v_monto, 
                'Reverso por cambio de estado en Pedido #' || OLD.numero_pedido || ' de completado a ' || NEW.estado
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que el trigger esté vinculado
DROP TRIGGER IF EXISTS trig_act_saldos_admin_pedidos ON public.pedidos;
CREATE TRIGGER trig_act_saldos_admin_pedidos
AFTER UPDATE OF estado ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trig_act_saldos_admin();

-- =========================================================
-- BLOQUE DE LIMPIEZA: Corregir duplicados generados por la migración 099
-- Solo actúa sobre créditos de las últimas 48 horas que tengan duplicidad de moneda
-- =========================================================
DO $$
DECLARE
    r RECORD;
    v_is_bs BOOLEAN;
    v_metodo_pago RECORD;
    v_monto_to_remove NUMERIC;
    v_moneda_to_remove TEXT;
    v_count INT := 0;
BEGIN
    FOR r IN (
        SELECT h1.pedido_id, h1.admin_id, p.referencia_pago, p.metodo_pago_id, p.total_bs, p.total_usd, p.numero_pedido
        FROM public.admin_saldos_historial h1
        JOIN public.admin_saldos_historial h2 ON h1.pedido_id = h2.pedido_id AND h1.admin_id = h2.admin_id
        JOIN public.pedidos p ON h1.pedido_id = p.id
        WHERE h1.moneda = 'usd' AND h2.moneda = 'bs'
        AND h1.tipo_movimiento = 'credito_venta' AND h2.tipo_movimiento = 'credito_venta'
        AND h1.created_at > now() - interval '48 hours'
    ) LOOP
        -- Determinar cuál es la moneda correcta
        v_is_bs := false;
        IF r.referencia_pago ILIKE '%billetera bs%' OR r.referencia_pago ILIKE '%pago móvil%' OR r.referencia_pago ILIKE '%pago movil%' OR r.referencia_pago ILIKE '%bolívares%' OR r.referencia_pago ILIKE '%bs%' THEN
            v_is_bs := true;
        ELSIF r.metodo_pago_id IS NOT NULL THEN
            SELECT nombre, habilitado_billetera_bs INTO v_metodo_pago FROM public.metodos_pago WHERE id = r.metodo_pago_id;
            IF v_metodo_pago.habilitado_billetera_bs = true OR v_metodo_pago.nombre ILIKE '%pago%' OR v_metodo_pago.nombre ILIKE '%bs%' OR v_metodo_pago.nombre ILIKE '%bolívares%' THEN
                v_is_bs := true;
            END IF;
        END IF;

        IF v_is_bs THEN
            -- El pago fue en BS, debemos eliminar el crédito extra en USD
            v_monto_to_remove := r.total_usd;
            v_moneda_to_remove := 'usd';
        ELSE
            -- El pago fue en USD, debemos eliminar el crédito extra en BS
            v_monto_to_remove := r.total_bs;
            v_moneda_to_remove := 'bs';
        END IF;

        -- Restar del saldo del admin
        IF v_moneda_to_remove = 'usd' THEN
            UPDATE public.admin_saldos SET saldo_usd = saldo_usd - v_monto_to_remove WHERE auth_user_id = r.admin_id;
        ELSE
            UPDATE public.admin_saldos SET saldo_bs = saldo_bs - v_monto_to_remove WHERE auth_user_id = r.admin_id;
        END IF;

        -- Eliminar la entrada incorrecta del historial
        DELETE FROM public.admin_saldos_historial 
        WHERE pedido_id = r.pedido_id 
        AND admin_id = r.admin_id 
        AND moneda = v_moneda_to_remove 
        AND tipo_movimiento = 'credito_venta';

        v_count := v_count + 1;
        RAISE NOTICE 'Corregido pedido #%: Eliminado crédito extra de % %', r.numero_pedido, v_monto_to_remove, v_moneda_to_remove;
    END LOOP;
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Limpieza completada: % registros corregidos.', v_count;
    END IF;
END $$;
