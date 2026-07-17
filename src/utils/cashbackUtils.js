import { supabase } from '../lib/supabase';

export async function applyClientCashback(pedidoId, userId) {
    try {
        const { data: pedido } = await supabase.from('pedidos').select('*, pedido_items(*, productos(juego_id, juegos(cashback_activo)))').eq('id', pedidoId).single();
        if (!pedido || pedido.cashback_aplicado) return;

        const { data: configData } = await supabase.from('configuracion').select('*').in('clave', ['cashback_activo', 'cashback_porcentaje']);
        const config = {};
        if (configData) {
            configData.forEach(c => { config[c.clave] = c.valor_texto !== null ? c.valor_texto : String(c.valor); });
        }

        if (config.cashback_activo !== 'true' && config.cashback_activo !== '1') return;
        const porcentaje = Number(config.cashback_porcentaje) || 0;
        if (porcentaje <= 0) return;

        let gameAllowsCashback = true;
        if (pedido.pedido_items && pedido.pedido_items.length > 0) {
            const prod = Array.isArray(pedido.pedido_items[0].productos) ? pedido.pedido_items[0].productos[0] : pedido.pedido_items[0].productos;
            if (prod?.juegos?.cashback_activo === false) gameAllowsCashback = false;
        }

        if (!gameAllowsCashback) return;

        const ref = (pedido.referencia_pago || '').toLowerCase();
        let isBs = ref.includes('billetera bs') || ref.includes('pago móvil') || ref.includes('pago movil') || ref.includes('bolívares') || ref.includes('bs');
        
        if (!isBs && pedido.metodo_pago_id) {
           const { data: mData } = await supabase.from('metodos_pago').select('nombre, habilitado_billetera_bs').eq('id', pedido.metodo_pago_id).maybeSingle();
           if (mData && (
               mData.habilitado_billetera_bs || 
               mData.nombre.toLowerCase().includes('pago') || 
               mData.nombre.toLowerCase().includes('bs') || 
               mData.nombre.toLowerCase().includes('bolívares')
           )) {
               isBs = true;
           }
        }

        const { data: walletData } = await supabase.from('billeteras').select('*').eq('auth_user_id', pedido.cliente_id).maybeSingle();
        const baseUsd = walletData?.saldo || 0;
        const baseBs = walletData?.saldo_bs || 0;

        const updateData = {
            cashback_aplicado: true,
            cashback_porcentaje: porcentaje
        };

        if (isBs) {
           const returnBs = Number(pedido.total_bs) * (porcentaje / 100);
           if (returnBs > 0) {
             await supabase.rpc('ajustar_saldo_billetera_bs_rpc', {
               p_user_id: pedido.cliente_id,
               p_admin_id: userId || pedido.cliente_id,
               p_nuevo_saldo: baseBs + returnBs,
               p_nota: `💸 Cash Back (${porcentaje}%) por Pedido #${pedido.numero_pedido}`
             });
             updateData.cashback_monto = returnBs;
             updateData.cashback_moneda = 'bs';
           }
        } else {
           const returnUsd = Number(pedido.total_usd) * (porcentaje / 100);
           if (returnUsd > 0) {
             await supabase.rpc('ajustar_saldo_billetera_rpc', {
               p_user_id: pedido.cliente_id,
               p_admin_id: userId || pedido.cliente_id,
               p_nuevo_saldo: baseUsd + returnUsd,
               p_nota: `💸 Cash Back (${porcentaje}%) por Pedido #${pedido.numero_pedido}`
             });
             updateData.cashback_monto = returnUsd;
             updateData.cashback_moneda = 'usd';
           }
        }

        await supabase.from('pedidos').update(updateData).eq('id', pedido.id);
    } catch (err) {
        console.error('Error applying cashback:', err);
    }
}
