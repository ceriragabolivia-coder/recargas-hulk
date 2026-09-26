require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: order } = await supabase.from('pedidos').select('estado, razon_rechazo').eq('numero_pedido', 2217);
  console.log(order);
}
run();
