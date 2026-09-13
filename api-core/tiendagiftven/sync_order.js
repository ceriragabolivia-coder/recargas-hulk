import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { pedido_id } = req.body;
    if (!pedido_id) return res.status(400).json({ error: 'Falta pedido_id' });

    // Obtener items del pedido
    const { data: items, error: itemsError } = await supabase
      .from('pedido_items')
      .select('id, estado')
      .eq('pedido_id', pedido_id);

    if (itemsError) throw new Error(itemsError.message);

    // Obtener API Key
    const { data: configRows } = await supabase.from('configuracion').select('valor_texto').eq('clave', 'tiendagiftven_api_key').single();
    const apiKey = configRows?.valor_texto;
    if (!apiKey) throw new Error('API Key no configurada');

    let allSuccess = true;
    let anyUpdates = false;

    for (const item of items) {
      if (item.estado === 'completado' || item.estado === 'cancelado') continue;

      const merchantRef = `HULK-ITEM-${item.id}`;
      const statusRes = await fetch(`https://tiendagiftven.tech/api/v1/recargas/status?merchant_ref=${merchantRef}`, {
        headers: { 'X-API-Key': apiKey }
      });
      const statusData = await statusRes.json();

      if (statusData.ok && statusData.estado) {
        // Ejecutar el RPC como si fuera el webhook
        const { error: rpcError } = await supabase.rpc('procesar_webhook_tiendagiftven_rpc', {
          p_merchant_ref: merchantRef,
          p_pedido_id: pedido_id,
          p_estado: statusData.estado,
          p_mensaje: statusData.mensaje || 'Sincronización manual'
        });
        
        if (rpcError) {
          console.error("RPC Error:", rpcError);
          allSuccess = false;
        } else {
          anyUpdates = true;
        }
      } else {
        allSuccess = false;
      }
    }

    return res.status(200).json({ success: allSuccess, updated: anyUpdates });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
