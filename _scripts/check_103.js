import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://atcaolkiooosmdiipnkq.supabase.co';
const supabaseKey = 'sb_publishable_RvvCRLHf5NRqWZbyHHOKIA_X8V_90e8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: pedidoConItems, error } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(proveedor_api_id, juego_id, juegos(procesamiento_automatico_api)))')
    .eq('numero_pedido', 103)
    .single();

  if (error) {
     console.error("Error fetching:", error);
  } else {
     console.log(JSON.stringify(pedidoConItems, null, 2));
  }
}
check();
