const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.recargashulk.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA');

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
