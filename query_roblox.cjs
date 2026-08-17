const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.recargashulk.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA');

async function run() {
  const { data: productos } = await supabase.from('productos').select('*').eq('juego_id', 118);
  console.log("Productos:", productos);
}
run();
