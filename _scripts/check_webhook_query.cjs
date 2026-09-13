const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);
async function get() {
  const { data } = await supabase.from('pedidos').select('*, pedido_items(*, productos(*))').eq('id', 113).single();
  if (data && data.pedido_items && data.pedido_items[0]) {
    console.log('player_id:', data.pedido_items[0].player_id);
    console.log('proveedor_api_id:', data.pedido_items[0].productos.proveedor_api_id);
  } else {
    console.log('Not found or empty pedido_items:', data);
  }
}
get();
