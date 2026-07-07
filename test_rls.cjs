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
  const { data: user, error: loginErr } = await supabase.auth.signInWithPassword({ email: 'ceriragabolivia@gmail.com', password: 'password123' });
  const { data, error } = await supabase.from('pedidos').select('*, pedido_items(*)').eq('id', 114).single();
  console.log('Pedidos Admin:', JSON.stringify(data, null, 2), 'Error:', error);
}
test();
