const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://api.recargashulk.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA'
);

(async () => {
  const { data: recargas, error: e2 } = await supabase
    .from('billetera_recargas')
    .select('*')
    .eq('estado', 'pendiente')
    .limit(10);
    
  console.log("recargas pendientes:", recargas, e2);
})();
