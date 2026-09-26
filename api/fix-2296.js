import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Find pedido
  const { data: pedidos } = await supabase.from('pedidos').select('id').eq('numero_pedido', 2296).limit(1);
  if (!pedidos || pedidos.length === 0) return res.json({ error: 'Pedido not found' });
  
  const pedidoId = pedidos[0].id;
  
  // Update items
  const { error } = await supabase.from('pedido_items')
    .update({ estado_proveedor: 'completado', estado: 'completado' })
    .eq('pedido_id', pedidoId)
    .eq('estado_proveedor', 'procesando');
    
  return res.json({ success: true, pedidoId, error });
}
