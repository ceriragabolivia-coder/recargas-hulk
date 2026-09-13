import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: 'ceriraga@gmail.com', password: 'admin' });
  if (authError) {
    console.log('Auth Error:', authError.message);
  } else {
    console.log('Logged in as:', authData.user.id);
  }

  // Find order 506
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .eq('numero_pedido', '000506')
    .single();

  if (pedidoError || !pedido) {
    console.log('Pedido Error:', pedidoError);
    return;
  }

  console.log('Pedido 506 found:', pedido.id);
  console.log('Pago verificado:', pedido.pago_verificado);
  console.log('Estado:', pedido.estado);

  for (const item of pedido.pedido_items) {
    console.log('Entrega Automatica:', item.productos?.entrega_automatica);

    if (item.productos?.entrega_automatica) {
      const { data: codeData, error: assignError } = await supabase.rpc('asignar_codigo_pedido_item_rpc', {
        p_pedido_item_id: item.id
      });
      console.log('Assign RPC Result:', codeData, 'Error:', assignError);
    }
  }
}
check();
