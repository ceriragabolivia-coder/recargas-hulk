import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.rpc('procesar_pedido_automatico_rpc', {
    p_pedido_id: 512
  });
  console.log('Error from RPC:', error);

  // Lets try registrar_venta_rpc alone
  const { data: vData, error: vError } = await supabase.rpc('registrar_venta_rpc', {
    p_producto_id: 1,
    p_cantidad: 1,
    p_pedido_id: 512
  });
  console.log('Error from registrar_venta_rpc:', vError);
}
check();
