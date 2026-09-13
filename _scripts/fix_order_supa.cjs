const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vsmpxvzmferpqpfaulgb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk4MDgwOCwiZXhwIjoyMDgzNTU2ODA4fQ.n5p2GgI86YvP5_T_g9t6n-1aI1L_0L8rM0D6R7oG9W8');

async function run() {
  const { data: pedidos } = await supabase.from('pedidos').select('id, numero_pedido').in('numero_pedido', [1220, '1220', '001220']);
  const pedido = pedidos && pedidos[0];
  if (pedido) {
     const { data: items } = await supabase.from('pedido_items').select('*').eq('pedido_id', pedido.id);
     for (const item of items) {
         if (item.mensaje_proveedor && !item.codigo_entregado) {
             console.log('Actualizando item', item.id, 'con PIN:', item.mensaje_proveedor);
             await supabase.from('pedido_items').update({ codigo_entregado: item.mensaje_proveedor }).eq('id', item.id);
         }
     }
     console.log('Terminado.');
  } else {
     console.log('Pedido 1220 no encontrado.');
  }
}
run();
