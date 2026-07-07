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
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'ceriragabolivia@gmail.com', password: 'password123' });
  const { data: d2, error: e2 } = await supabase.from('pedido_items').select('*, productos(*)').limit(1);
  console.log('FK test:', JSON.stringify(d2, null, 2), 'Error:', e2);
}
get();
