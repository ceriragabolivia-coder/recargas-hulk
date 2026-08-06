const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const sb = createClient(url, key);

async function run() {
  const { data: pedidos, error } = await sb.from('pedidos').select('*, pedido_items(*)').eq('numero_pedido', 695);
  console.log("Error:", error);
  console.log("Pedidos:", JSON.stringify(pedidos, null, 2));
}

run();
