const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLatest() {
  console.log(`Fetching latest 5 orders...`);
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, created_at, pedido_items(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }

  data.forEach((order, index) => {
    console.log(`${index}: Order #${order.numero_pedido} (ID: ${order.id}) at ${order.created_at}`);
    order.pedido_items.forEach((item, i) => {
      console.log(`  Item ${i}: ${item.producto_nombre}`);
      console.log(`    - producto_icono: "${item.producto_icono}"`);
      console.log(`    - producto_id: ${item.producto_id}`);
    });
  });
}

checkLatest();
