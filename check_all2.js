import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { error: e1 } = await supabase.rpc('asignar_codigo_pedido_item_rpc', { p_pedido_item_id: 'not-a-uuid' });
  console.log('asignar_codigo_pedido_item_rpc(UUID string):', e1);

  const { error: e2 } = await supabase.rpc('asignar_codigo_pedido_item_rpc', { p_pedido_item_id: 123 });
  console.log('asignar_codigo_pedido_item_rpc(INT):', e2);
}
check();
