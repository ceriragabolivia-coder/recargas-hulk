import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Permitir peticiones desde cualquier origen (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  // Responder rápido a OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log('🔔 [FazerCards Webhook] Payload recibido:', JSON.stringify(payload, null, 2));

    // Si es un test de FazerCards
    if (payload.event === 'webhook.test') {
      return res.status(200).json({ success: true, message: 'Test recibido' });
    }

    // FazerCards suele enviar { event: "...", data: { id: "ord-...", status: "completed" } }
    const orderData = payload.data || payload.order || payload;
    const providerOrderId = orderData.id || orderData.order_id || payload.order_id;
    const providerStatus = orderData.status ? orderData.status.toLowerCase() : (payload.status ? payload.status.toLowerCase() : '');
    
    let pin = orderData.pin || orderData.code || payload.pin || payload.code || '';
    if (!pin && Array.isArray(orderData.cards) && orderData.cards.length > 0) {
      pin = orderData.cards.map(c => {
        if (typeof c === 'string') return c;
        return c.pin || c.code || '';
      }).filter(Boolean).join('\n');
    }

    if (!providerOrderId) {
      console.warn('⚠️ [FazerCards Webhook] No se encontró el ID de la orden en el payload:', JSON.stringify(payload).substring(0, 500));
      return res.status(400).json({ error: 'No order ID provided' });
    }

    // Buscar el item del pedido en nuestra base de datos utilizando el ID que nos dio FazerCards
    const { data: items, error: searchError } = await supabase
      .from('pedido_items')
      .select('id, pedido_id, estado_proveedor')
      .eq('proveedor_pedido_id', providerOrderId);

    if (searchError || !items || items.length === 0) {
      console.warn(`⚠️ [FazerCards Webhook] No se encontró un pedido local con el proveedor_pedido_id: ${providerOrderId}`);
      return res.status(404).json({ error: 'Local order not found' });
    }

    const isWebhookCompleted = providerStatus === 'completed' || providerStatus === 'delivered';
    
    // FazerCards webhooks sometimes only contain status updates without the pins.
    // If it's completed but we have no pin, we must fetch the full order details.
    if (isWebhookCompleted && !pin) {
      const { data: configData } = await supabase.from('configuracion').select('valor, valor_texto').eq('clave', 'fazercards_api_key').single();
      const apiKey = configData?.valor_texto || configData?.valor;
      if (apiKey) {
        try {
          const apiRes = await fetch(`https://api.fzr.cards/api/v2/orders/${providerOrderId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (apiRes.ok) {
            const apiOrder = await apiRes.json();
            if (apiOrder?.order?.cards && Array.isArray(apiOrder.order.cards)) {
              pin = apiOrder.order.cards.map(c => {
                if (typeof c === 'string') return c;
                return c.pin || c.code || '';
              }).filter(Boolean).join('\n');
            } else if (apiOrder?.order?.pin) {
              pin = apiOrder.order.pin;
            }
          }
        } catch (e) {
          console.error('Error fetching full order details from FazerCards API:', e.message);
        }
      }
    }

    // Podría haber múltiples items si se agruparon, pero normalmente es 1 a 1
    for (const item of items) {
      console.log(`⚡ [FazerCards Webhook] Actualizando item ${item.id} (Pedido: ${item.pedido_id}) a estado: ${providerStatus}`);

      const isCompleted = providerStatus === 'completed';
      const isFailed = providerStatus === 'cancelled' || providerStatus === 'error';
      
      const nuevoEstadoItem = isCompleted ? 'completado' : (isFailed ? 'fallido' : 'procesando');

      // Actualizar el item usando el RPC
      await supabase.rpc('webhook_update_pedido_item', {
        p_item_id: item.id,
        p_estado_proveedor: providerStatus,
        p_proveedor_pedido_id: providerOrderId,
        p_mensaje_proveedor: pin,
        p_estado: nuevoEstadoItem,
        p_codigo_entregado: pin || null
      });

      // Intentar auto-procesar el pedido completo si todos los items ya terminaron
      if (isCompleted || isFailed) {
        try {
           // Hacemos un llamado interno o fetch a nuestra propia ruta de auto_process para que cierre el pedido general
           const origin = req.headers.host ? `https://${req.headers.host}` : 'https://recargashulk.com';
           await fetch(`${origin}/api/pedidos/auto_process`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pedido_id: item.pedido_id, force: true })
           });
        } catch (e) {
           console.error('Error llamando a auto_process desde FazerCards webhook:', e.message);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [FazerCards Webhook] Error interno:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
