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
  const { data, error } = await supabase.rpc('exec_sql', {
    p_sql: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('pedidos', 'pagos_apk', 'billetera_recargas');
    `
  });
  console.log(data || error);
}
run();
