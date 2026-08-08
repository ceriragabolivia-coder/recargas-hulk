const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.vercel' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('pedido_items')
    .select('id, pedido_id, proveedor_pedido_id, estado_proveedor')
    .order('id', { ascending: false })
    .limit(5);
  
  if (error) console.error(error);
  else console.log(data);
}
check();
