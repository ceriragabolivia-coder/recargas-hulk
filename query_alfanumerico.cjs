const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.recargashulk.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA');

async function run() {
  const { data: juegosAlfanumerico } = await supabase.from('juegos').select('id, nombre').eq('metodo_recarga', 'id_alfanumerico');
  console.log("Juegos Alfanumericos:", juegosAlfanumerico);
}
run();
