import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase no configurado en variables de entorno');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-KEY, API-SECRET, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Si envían un GET para verificar si el endpoint responde
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Xanler Webhook endpoint activo' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    console.log('🔔 [Xanler Webhook] Callback recibido:', JSON.stringify(payload, null, 2));

    const supabase = getSupabase();

    // Extraer campos posibles según estructura de Xanler
    const orderData = payload.data || payload.order || payload;
    const providerOrderId = String(orderData.order_id || orderData.id || payload.order_id || '').trim();
    const rawStatus = String(orderData.status || payload.status || '').toLowerCase();
    const note = orderData.note || payload.note || orderData.message || payload.message || '';
    const nickname = orderData.nickname || payload.nickname || '';

    if (!providerOrderId) {
      console.warn('⚠️ [Xanler Webhook] No se encontró order_id en el payload:', JSON.stringify(payload));
      // Respondemos 200 para que el proveedor no reintente indefinidamente si era un ping de prueba
      return res.status(200).json({ ok: true, message: 'Ping recibido sin order_id' });
    }

    // Buscar el item asociado en pedido_items
    let { data: items, error: searchError } = await supabase
      .from('pedido_items')
      .select('id, pedido_id, estado, estado_proveedor')
      .eq('proveedor_pedido_id', providerOrderId);

    if (searchError || !items || items.length === 0) {
      console.warn(`⚠️ [Xanler Webhook] No se encontró el pedido local con proveedor_pedido_id: ${providerOrderId}. Reintentando en 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      const retry = await supabase
        .from('pedido_items')
        .select('id, pedido_id, estado, estado_proveedor')
        .eq('proveedor_pedido_id', providerOrderId);
      items = retry.data;
    }

    if (!items || items.length === 0) {
      console.warn(`⚠️ [Xanler Webhook] Definitivamente no se encontró el pedido local con ID: ${providerOrderId}`);
      return res.status(200).json({ ok: false, message: 'Item no encontrado en el sistema' });
    }

    const isCompleted = rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'sukses';
    const isFailed = rawStatus === 'canceled' || rawStatus === 'cancelled' || rawStatus === 'failed' || rawStatus === 'gagal' || rawStatus === 'error';

    const nuevoEstadoItem = isCompleted ? 'completado' : (isFailed ? 'fallido' : 'procesando');
    const mensajeProveedor = note ? `Xanler: ${note}${nickname ? ` | Nick: ${nickname}` : ''}` : (isCompleted ? 'Recarga Completada' : rawStatus);

    for (const item of items) {
      console.log(`⚡ [Xanler Webhook] Actualizando item ${item.id} a estado: ${nuevoEstadoItem}`);
      await supabase.rpc('webhook_update_pedido_item', {
        p_item_id: item.id,
        p_estado_proveedor: rawStatus,
        p_proveedor_pedido_id: providerOrderId,
        p_mensaje_proveedor: mensajeProveedor,
        p_estado: nuevoEstadoItem,
        p_codigo_entregado: isCompleted ? (note || 'Recarga Completada') : null
      });

      // Si se completó, verificar si todo el pedido está completado
      if (isCompleted) {
        const { data: allItems } = await supabase
          .from('pedido_items')
          .select('estado')
          .eq('pedido_id', item.pedido_id);

        const todosCompletados = allItems?.every(it => it.estado === 'completado');
        if (todosCompletados) {
          await supabase.rpc('webhook_update_pedido', {
            p_pedido_id: item.pedido_id,
            p_estado: 'completado',
            p_venta_registrada: true,
            p_fecha_respuesta: new Date().toISOString()
          });
        }
      }
    }

    return res.status(200).json({ ok: true, message: 'Webhook procesado exitosamente' });
  } catch (error) {
    console.error('❌ Error procesando Xanler Webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}
