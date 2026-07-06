import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function test() {
  // 1. Insert a pending recharge
  const { data: recarga, error: err1 } = await supabase.from('billetera_recargas').insert({
    auth_user_id: '11051a90-67d0-41ec-ab5c-be9d8ec9bc01',
    monto: 10,
    moneda: 'bs',
    estado: 'pendiente',
    referencia_pago: 'test1234'
  }).select().single();
  if (err1) { console.error('Insert Error:', err1); return; }
  
  // 2. Call RPC
  const { data: result, error: err2 } = await supabase.rpc('procesar_recarga_automatica_rpc', {
    p_recarga_id: recarga.id
  });
  console.log('RPC Result:', result);
  console.log('RPC Error:', err2);
  
  // 3. Cleanup
  await supabase.from('billetera_recargas').delete().eq('id', recarga.id);
}
test();
