const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://api.recargashulk.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('juegos').select('id, nombre, tutorial_activo').ilike('nombre', '%roblox%');
  console.log(data, error);
}
test();
