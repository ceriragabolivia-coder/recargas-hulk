const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function get() {
  const { data } = await supabase.from('pedidos').select('*, pedido_items(*, productos(*))').eq('id', 114).single();
  console.log('Pedido:', JSON.stringify(data, null, 2));
}
get();
