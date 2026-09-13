import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2FvbGtpb29vc21kaWlwbmtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTkxOTY1NiwiZXhwIjoyMDk3NDk1NjU2fQ.GihNB21XQWuMEstWeXL8HoFPHj71BHcKWKRiu8OZ03A'
);

async function check() {
  // Check order 121
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, total_bs, total_usd, referencia_pago, pago_verificado')
    .eq('numero_pedido', '000121')
    .single();

  console.log('=== PEDIDO #000121 ===');
  console.log(JSON.stringify(pedido, null, 2));

  if (pedido) {
    const { data: items, error } = await supabase
      .from('pedido_items')
      .select('*')
      .eq('pedido_id', pedido.id);

    console.log('\n=== ITEMS ===');
    console.log('Count:', items?.length || 0);
    console.log(JSON.stringify(items, null, 2));
    if (error) console.log('Error:', error);
  }

  // Also check latest orders to see which ones have items
  const { data: recent } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, pedido_items(id)')
    .order('id', { ascending: false })
    .limit(10);

  console.log('\n=== ÚLTIMOS 10 PEDIDOS ===');
  for (const p of (recent || [])) {
    console.log(`#${p.numero_pedido} (id:${p.id}) - ${p.estado} - items: ${p.pedido_items?.length || 0}`);
  }
}

check();
