import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.rpc('get_rpc_definition', { func_name: 'procesar_recarga_automatica_rpc' });
  console.log(data || error);
}
run();
