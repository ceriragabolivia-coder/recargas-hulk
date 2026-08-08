import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if(key && value.length > 0) env[key.trim()] = value.join('=').trim().replace(/[\'\"]/g, '').replace('\r', '');
});

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  const p = await supabase.from('pedidos').select('*').limit(1);
  const pA = await supabase.from('pagos_apk').select('*').limit(1);
  const b = await supabase.from('billetera_recargas').select('*').limit(1);
  console.log('pedidos:', Object.keys(p.data?.[0] || {}));
  console.log('pagos_apk:', Object.keys(pA.data?.[0] || {}));
  console.log('billetera_recargas:', Object.keys(b.data?.[0] || {}));
}
run();
