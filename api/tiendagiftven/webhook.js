import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key para tener permisos
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log('📦 Webhook TiendaGiftVen Recibido:', payload);

    const merchant_ref = payload.merchant_ref || payload.ref;
    const pedido_id = payload.pedido_id || payload.id_pedido;
    const mensaje = payload.mensaje;
    const codigos = payload.codigos;
    let estado = payload.estado ? payload.estado.toLowerCase() : '';

    if (!merchant_ref) {
      return res.status(400).json({ error: 'Missing merchant_ref or ref' });
    }

    // Llamar al RPC unificado que tiene SECURITY DEFINER para evitar problemas de RLS en Vercel
    const { data: rpcData, error: rpcError } = await supabase.rpc('procesar_webhook_tiendagiftven_rpc', {
      p_merchant_ref: merchant_ref,
      p_pedido_id: pedido_id,
      p_estado: estado,
      p_mensaje: Array.isArray(codigos) && codigos.length > 0 ? codigos.join('\n') : (codigos && typeof codigos === 'string' ? codigos : (mensaje || ''))
    });

    if (rpcError) {
      console.error('❌ Error ejecutando RPC procesar_webhook_tiendagiftven_rpc:', rpcError);
      return res.status(500).json({ error: 'Database RPC failed' });
    }

    console.log(`✅ Resultado del Webhook RPC:`, rpcData);
    return res.status(200).json({ ok: true, message: 'Webhook processed', data: rpcData });

  } catch (error) {
    console.error('❌ Error general en Webhook TiendaGiftVen:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
