import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function test() {
  const { data } = await supabase.from('billetera_recargas').select('id, referencia_pago, estado').order('created_at', { ascending: false }).limit(5);
  console.log(data);
}
test();
