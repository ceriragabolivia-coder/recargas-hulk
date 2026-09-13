import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function check() {
  const supabase = createClient(url, key);
  
  // Login as admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@ceriraga.com',
    password: 'admin'
  });

  const { data: pedidoList, error: pError } = await supabase.from('pedidos')
    .select('id, numero_pedido, estado, pago_verificado, pedido_items(id, codigo_entregado)')
    .in('numero_pedido', [500, 501, 502]);
  
  console.log(JSON.stringify(pedidoList, null, 2));
}
check();
