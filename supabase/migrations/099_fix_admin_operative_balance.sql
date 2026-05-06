-- 099_fix_admin_operative_balance.sql
-- Fix the trigger that credits admin operative balance to handle both USD and BS

CREATE OR REPLACE FUNCTION public.trig_act_saldos_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_monto_usd NUMERIC;
    v_monto_bs NUMERIC;
BEGIN
    v_monto_usd := COALESCE(NEW.total_usd, 0);
    v_monto_bs := COALESCE(NEW.total_bs, 0);

    -- Solo actuar cuando el estado cambia a 'completado'
    IF NEW.estado = 'completado' AND (TG_OP = 'INSERT' OR OLD.estado != 'completado') THEN
        IF NEW.atendido_por_id IS NOT NULL THEN
            
            -- Actualizar o insertar el saldo del admin
            INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, saldo_bs, updated_at)
            VALUES (NEW.atendido_por_id, v_monto_usd, v_monto_bs, now())
            ON CONFLICT (auth_user_id) 
            DO UPDATE SET 
                saldo_usd = public.admin_saldos.saldo_usd + EXCLUDED.saldo_usd,
                saldo_bs = public.admin_saldos.saldo_bs + EXCLUDED.saldo_bs,
                updated_at = now();

            -- Registrar en el historial de USD si hay monto
            IF v_monto_usd > 0 THEN
              INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
              VALUES (NEW.atendido_por_id, NEW.id, 'credito_venta', 'usd', v_monto_usd, 'Crédito automático USD Pedido #' || NEW.numero_pedido);
            END IF;

            -- Registrar en el historial de BS si hay monto
            IF v_monto_bs > 0 THEN
              INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
              VALUES (NEW.atendido_por_id, NEW.id, 'credito_venta', 'bs', v_monto_bs, 'Crédito automático Bs Pedido #' || NEW.numero_pedido);
            END IF;

        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger ya existe desde la migración 085, así que solo actualizamos la función.
-- Pero para estar seguros de que está bien vinculado al cambio de estado:
DROP TRIGGER IF EXISTS trig_act_saldos_admin_pedidos ON public.pedidos;
CREATE TRIGGER trig_act_saldos_admin_pedidos
AFTER UPDATE OF estado ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trig_act_saldos_admin();
