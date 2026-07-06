import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function test() {
  const { data, error } = await supabase.from('billetera_recargas').select('id, estado').eq('referencia_pago', '864432');
  console.log(data);
  if (data && data.length > 0) {
    console.log("Calling RPC on:", data[0].id);
    const { data: res, error: err } = await supabase.rpc('procesar_recarga_automatica_rpc', { p_recarga_id: data[0].id });
    console.log("RPC Data:", res);
    console.log("RPC Error:", err);
  }
}
test();
