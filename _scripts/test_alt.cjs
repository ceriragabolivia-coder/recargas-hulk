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
  const { data: p } = await supabase.from('pedidos').select('*, pedido_items(*, productos(juego_id))').eq('id', 107).single();
  const juegoIds = p.pedido_items.map(i => i.productos.juego_id);
  const { data: juegos } = await supabase.from('juegos').select('id, procesamiento_automatico_api').in('id', juegoIds);
  console.log('Result:', JSON.stringify(juegos, null, 2));
}
check();
