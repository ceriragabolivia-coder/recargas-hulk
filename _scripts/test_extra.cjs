const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('pedido_items').insert({ pedido_id: 114, producto_id: 11, cantidad: 1, precio_unitario: 1, subtotal: 1, asdf_extra_col: 'test' });
  console.log('Error:', error);
}
test();
