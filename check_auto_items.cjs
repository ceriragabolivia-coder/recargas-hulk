const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const pedidoId = 107;
  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .eq('id', pedidoId)
    .single();
    
  console.log('Items:');
  for (const item of pedidoActual.pedido_items) {
    console.log(`- Item ${item.id}:`, {
      proveedor_api_id: item.productos?.proveedor_api_id,
      proveedor_pedido_id: item.proveedor_pedido_id,
      estado_proveedor: item.estado_proveedor
    });
  }
}
check();
