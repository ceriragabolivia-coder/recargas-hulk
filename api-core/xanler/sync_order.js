import { createClient } from '@supabase/supabase-js';
import { checkOrderStatus } from './client.js';

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase no configurado en variables de entorno');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const supabase = getSupabase();
    const { pedido_id } = req.body;
    if (!pedido_id) {
      return res.status(400).json({ error: 'Falta pedido_id' });
    }

    // 1. Obtener items del pedido que fueron enviados a Xanler
    const { data: items, error: itemsError } = await supabase
      .from('pedido_items')
      .select('id, estado, proveedor_pedido_id, estado_proveedor')
      .eq('pedido_id', pedido_id);

    if (itemsError) throw new Error(itemsError.message);

    // 2. Obtener credenciales de Xanler
    const { data: configRows } = await supabase
      .from('configuracion')
      .select('clave, valor_texto, valor')
      .in('clave', ['xanler_api_key', 'xanler_api_secret']);

    const apiKey = configRows?.find(r => r.clave === 'xanler_api_key')?.valor_texto;
    const apiSecret = configRows?.find(r => r.clave === 'xanler_api_secret')?.valor_texto;

    if (!apiKey || !apiSecret) {
      throw new Error('Credenciales de Xanler no configuradas');
    }

    let allCompleted = true;
    let anyUpdates = false;

    for (const item of items) {
      if (item.estado === 'completado') continue;
      if (!item.proveedor_pedido_id) {
        allCompleted = false;
        continue;
      }

      try {
        const statusRes = await checkOrderStatus(item.proveedor_pedido_id, apiKey, apiSecret);
        if (statusRes && statusRes.status && statusRes.data) {
          const providerStatus = (statusRes.data.status || '').toLowerCase();
          const note = statusRes.data.note || '';
          const nickname = statusRes.data.nickname || '';

          const isCompleted = providerStatus === 'success' || providerStatus === 'completed';
          const isFailed = providerStatus === 'canceled' || providerStatus === 'failed' || providerStatus === 'rejected';

          if (isCompleted) {
            await supabase.rpc('webhook_update_pedido_item', {
              p_item_id: item.id,
              p_estado_proveedor: providerStatus,
              p_proveedor_pedido_id: item.proveedor_pedido_id,
              p_mensaje_proveedor: note ? `Completado: ${note}${nickname ? ` | ${nickname}` : ''}` : 'Recarga Completada en Xanler',
              p_estado: 'completado',
              p_codigo_entregado: note || 'Recarga Completada'
            });
            anyUpdates = true;
          } else if (isFailed) {
            allCompleted = false;
            await supabase.rpc('webhook_update_pedido_item', {
              p_item_id: item.id,
              p_estado_proveedor: 'fallido',
              p_proveedor_pedido_id: item.proveedor_pedido_id,
              p_mensaje_proveedor: note || 'Orden cancelada/fallida en Xanler',
              p_estado: 'fallido'
            });
            anyUpdates = true;
          } else {
            allCompleted = false;
          }
        } else {
          allCompleted = false;
        }
      } catch (err) {
        console.error(`Error verificando orden Xanler ${item.proveedor_pedido_id}:`, err);
        allCompleted = false;
      }
    }

    if (allCompleted && anyUpdates) {
      await supabase.rpc('webhook_update_pedido', {
        p_pedido_id: pedido_id,
        p_estado: 'completado',
        p_venta_registrada: true,
        p_fecha_respuesta: new Date().toISOString()
      });
    }

    return res.status(200).json({ success: true, allCompleted, updated: anyUpdates });
  } catch (err) {
    console.error('❌ Error en sync_order Xanler:', err);
    return res.status(500).json({ error: err.message });
  }
}
