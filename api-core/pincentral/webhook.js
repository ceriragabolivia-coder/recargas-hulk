import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const xSignature = req.headers['x-signature'];
  const xDate = req.headers['x-date'];

  if (!xSignature || !xDate) {
    return res.status(400).json({ error: 'Faltan cabeceras de seguridad' });
  }

  try {
    // 1. Obtener credenciales de la DB
    const { data: configRows, error: configError } = await supabase
      .from('configuracion')
      .select('valor_texto')
      .eq('clave', 'pincentral_api_secret')
      .single();

    if (configError || !configRows) {
      console.error("Error obteniendo api_secret de PinCentral:", configError);
      return res.status(500).json({ error: 'Configuración no encontrada' });
    }

    const apiSecret = configRows.valor_texto;

    // 2. Validar firma
    // En Vercel req.body ya viene parseado, necesitamos el JSON string tal cual
    // Es posible que tengamos que reconstruirlo
    const bodyString = JSON.stringify(req.body);
    const hmacContent = `${xDate}-${bodyString}`;
    const hmac = crypto.createHmac('sha256', apiSecret).update(hmacContent).digest('hex');

    if (hmac !== xSignature) {
      console.error('❌ Webhook PinCentral: Firma inválida', { expected: hmac, received: xSignature });
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const payload = req.body;
    console.log('📦 Webhook PinCentral Recibido:', payload);

    // 3. Procesar payload
    if (payload.event === 'pin_order' || payload.event === 'recharge') {
      const orderIdStr = payload.order_id; // Ejemplo: 'HULK-1234'
      if (!orderIdStr || !orderIdStr.startsWith('HULK-')) {
        console.warn('Webhook ignorado: order_id no es nuestro', orderIdStr);
        return res.status(200).json({ status: 'ignored' });
      }

      const itemId = parseInt(orderIdStr.replace('HULK-', ''), 10);
      const status = payload.status; // 'captured', 'completed', 'denied', 'error', 'cancelled'
      
      let finalStatus = status;
      let extractedCodes = '';
      
      if (payload.event === 'recharge' && status === 'completed') {
        extractedCodes = payload.receipt || 'Recarga Completada';
      } else if (payload.event === 'pin_order' && status === 'captured') {
        if (payload.pins && payload.pins.length > 0) {
          extractedCodes = payload.pins.map(p => {
            let code = p.key || p.pin || p.code || '';
            if (p.serial) code += ` (Serial: ${p.serial})`;
            return code;
          }).join('\n');
        }
      }

      const isCompleted = (status === 'completed' || status === 'captured');
      const isFailed = (status === 'error' || status === 'denied' || status === 'cancelled');

      let globalStatus = 'procesando';
      if (isCompleted) globalStatus = 'completado';
      if (isFailed) globalStatus = 'error';

      console.log(`📦 Webhook procesando Item ID: ${itemId} | Status: ${globalStatus}`);

      await supabase.rpc("webhook_update_pedido_item", {
        p_item_id: itemId,
        p_estado_proveedor: status,
        p_proveedor_pedido_id: payload.id,
        p_mensaje_proveedor: extractedCodes || (isFailed ? 'Error del proveedor' : ''),
        p_estado: globalStatus,
        p_codigo_entregado: extractedCodes || null,
      });
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Error en webhook PinCentral:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
