const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.recargashulk.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA');
async function run() {
  const { data: pedidos } = await supabase.from('pedidos').select('id, numero_pedido').in('numero_pedido', [1566, 1567]);
  console.log('Pedidos:', pedidos);
  if (!pedidos) return;
  for (const p of pedidos) {
    const { data: items } = await supabase.from('pedido_items').select('*').eq('pedido_id', p.id);
    for (const item of items) {
       console.log('Testing item', item.id);
       const { data, error } = await supabase.rpc('procesar_webhook_tiendagiftven_rpc', {
         p_merchant_ref: 'HULK-ITEM-' + item.id,
         p_pedido_id: p.id,
         p_estado: 'completado',
         p_mensaje: 'test manual'
       });
       console.log('Result:', data, 'Error:', error);
    }
  }
}
run();
