const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE OR REPLACE FUNCTION public.trig_aplicar_cashback_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_config_activo BOOLEAN;
    v_config_porcentaje NUMERIC;
    v_juego_cashback_activo BOOLEAN;
    v_item RECORD;
    v_producto RECORD;
    v_is_bs BOOLEAN;
    v_metodo RECORD;
    v_return_monto NUMERIC;
    v_return_moneda TEXT;
BEGIN
    IF NEW.estado = 'completado' AND (OLD.estado IS NULL OR OLD.estado != 'completado') AND NEW.cashback_aplicado = FALSE THEN
        
        SELECT (valor_texto = 'true' OR valor = 1) INTO v_config_activo FROM configuracion WHERE clave = 'cashback_activo' LIMIT 1;
        SELECT COALESCE(valor::NUMERIC, 0) INTO v_config_porcentaje FROM configuracion WHERE clave = 'cashback_porcentaje' LIMIT 1;
        
        IF COALESCE(v_config_activo, false) = true AND COALESCE(v_config_porcentaje, 0) > 0 THEN
            
            v_juego_cashback_activo := true;
            SELECT * INTO v_item FROM pedido_items WHERE pedido_id = NEW.id LIMIT 1;
            IF FOUND THEN
                SELECT * INTO v_producto FROM productos WHERE id = v_item.producto_id;
                IF FOUND THEN
                    SELECT cashback_activo INTO v_juego_cashback_activo FROM juegos WHERE id = v_producto.juego_id;
                END IF;
            END IF;
            
            IF COALESCE(v_juego_cashback_activo, true) = true THEN
                v_is_bs := FALSE;
                IF LOWER(COALESCE(NEW.referencia_pago, '')) LIKE '%billetera bs%' OR 
                   LOWER(COALESCE(NEW.referencia_pago, '')) LIKE '%pago móvil%' OR
                   LOWER(COALESCE(NEW.referencia_pago, '')) LIKE '%pago movil%' OR
                   LOWER(COALESCE(NEW.referencia_pago, '')) LIKE '%bolívares%' OR
                   LOWER(COALESCE(NEW.referencia_pago, '')) LIKE '%bs%' THEN
                    v_is_bs := TRUE;
                ELSIF NEW.metodo_pago_id IS NOT NULL THEN
                    SELECT * INTO v_metodo FROM metodos_pago WHERE id = NEW.metodo_pago_id;
                    IF FOUND AND (
                        v_metodo.habilitado_billetera_bs OR 
                        LOWER(v_metodo.nombre) LIKE '%pago%' OR 
                        LOWER(v_metodo.nombre) LIKE '%bs%' OR 
                        LOWER(v_metodo.nombre) LIKE '%bolívares%'
                    ) THEN
                        v_is_bs := TRUE;
                    END IF;
                END IF;
                
                IF v_is_bs THEN
                    v_return_monto := NEW.total_bs * (v_config_porcentaje / 100);
                    v_return_moneda := 'bs';
                    IF v_return_monto > 0 THEN
                        PERFORM public.ajustar_saldo_billetera_bs_rpc(
                            NEW.cliente_id, 
                            NEW.atendido_por_id, 
                            (SELECT COALESCE(saldo_bs, 0) FROM billeteras WHERE auth_user_id = NEW.cliente_id) + v_return_monto,
                            '💸 Cash Back (' || v_config_porcentaje || '%) por Pedido #' || NEW.numero_pedido
                        );
                    END IF;
                ELSE
                    v_return_monto := NEW.total_usd * (v_config_porcentaje / 100);
                    v_return_moneda := 'usd';
                    IF v_return_monto > 0 THEN
                        PERFORM public.ajustar_saldo_billetera_rpc(
                            NEW.cliente_id, 
                            NEW.atendido_por_id,
                            (SELECT COALESCE(saldo, 0) FROM billeteras WHERE auth_user_id = NEW.cliente_id) + v_return_monto,
                            '💸 Cash Back (' || v_config_porcentaje || '%) por Pedido #' || NEW.numero_pedido
                        );
                    END IF;
                END IF;
                
                IF COALESCE(v_return_monto, 0) > 0 THEN
                    NEW.cashback_aplicado := TRUE;
                    NEW.cashback_monto := v_return_monto;
                    NEW.cashback_moneda := v_return_moneda;
                    NEW.cashback_porcentaje := v_config_porcentaje;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_aplicar_cashback_pedido_after ON pedidos;
CREATE TRIGGER trig_aplicar_cashback_pedido_after
BEFORE UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION trig_aplicar_cashback_pedido();

NOTIFY pgrst, 'reload schema';
`;

async function deploy() {
  const { data, error } = await supabase.rpc('run_sql', { query: sql });
  if (error) {
    console.error('Error applying trigger:', error);
  } else {
    console.log('Trigger applied successfully', data);
  }
}
deploy();
