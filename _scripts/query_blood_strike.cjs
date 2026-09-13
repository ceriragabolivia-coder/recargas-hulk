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
  const { data, error } = await supabase
    .from('pedido_items')
    .select('id, pedido_id, productos!inner(nombre), player_id, zone_id, estado_proveedor, mensaje_proveedor')
    .ilike('productos.nombre', '%Blood Strike%')
    .order('id', { ascending: false })
    .limit(10);
  
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
check();
