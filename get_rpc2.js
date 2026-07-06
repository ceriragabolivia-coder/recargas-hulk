import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.rpc('get_table_info', { p_table_name: 'pagos_apk' });
  console.log(error); // this also fails if get_table_info is not there.
}
run();
