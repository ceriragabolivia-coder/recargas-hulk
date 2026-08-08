import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if(key && value.length > 0) env[key.trim()] = value.join('=').trim().replace(/[\'\"]/g, '').replace('\r', '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('pedidos').select('*, pedido_items(*)').eq('numero_pedido', '#000813');
  console.log(JSON.stringify({data, error}, null, 2));
}
run();
