import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { referencia } = req.body;
  if (!referencia) return res.status(400).json({ error: 'Falta la referencia' });

  try {
    const refStr = String(referencia).trim();

    // 1. Buscar si hay un pedido con esta referencia
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id')
      .eq('referencia_pago', refStr)
      .limit(1)
      .maybeSingle();

    if (pedido) {
      await supabase.from('pagos_apk').update({ status: 'usado', pedido_id: pedido.id }).eq('referencia', refStr).eq('status', 'disponible');
      return res.status(200).json({ success: true, message: 'Pago marcado como usado (Pedido)' });
    }

    // 2. Buscar si hay una recarga con esta referencia
    const { data: recarga } = await supabase
      .from('billetera_recargas')
      .select('id')
      .eq('referencia_pago', refStr)
      .limit(1)
      .maybeSingle();

    if (recarga) {
      await supabase.from('pagos_apk').update({ status: 'usado', relacion_manual: `Recarga #${recarga.id}` }).eq('referencia', refStr).eq('status', 'disponible');
      return res.status(200).json({ success: true, message: 'Pago marcado como usado (Recarga)' });
    }

    // Si no hay pedido ni recarga, no podemos marcarlo como usado por seguridad
    return res.status(400).json({ error: 'No se encontró un pedido o recarga con esa referencia' });
    
  } catch (error) {
    console.error('Error en marcar_usado API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
