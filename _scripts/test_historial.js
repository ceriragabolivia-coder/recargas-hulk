import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function test() {
  const { data } = await supabase.from('historial_referencias').select('*').eq('referencia', '880721');
  console.log(JSON.stringify(data, null, 2));
}
test();
