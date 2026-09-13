import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function check() {
  const supabase = createClient(url, key);
  
  // Login as admin
  await supabase.auth.signInWithPassword({
    email: 'admin@ceriraga.com',
    password: 'admin'
  });

  const { data: pedidoList, error: pError } = await supabase.from('pedidos')
    .select('id, numero_pedido, estado, pago_verificado, pedido_items(id, codigo_entregado, producto_id, cantidad)')
    .eq('numero_pedido', 504);
  
  console.log('Pedido 504:', JSON.stringify(pedidoList, null, 2));

  if (pedidoList && pedidoList.length > 0) {
    for (let item of pedidoList[0].pedido_items) {
      console.log('Stock for prod', item.producto_id);
      const { count } = await supabase.from('producto_codigos')
        .select('*', { count: 'exact', head: true })
        .eq('producto_id', item.producto_id)
        .eq('usado', false);
      console.log('Count:', count);
    }
  }
}
check();
