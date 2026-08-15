const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://api.recargashulk.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA'
);

(async () => {
  const { data, error } = await supabase
    .from('pagos_apk')
    .select('*')
    .ilike('referencia', '%62067%')
    .limit(5);
    
  console.log("pagos_apk:", data, error);
  
  const { data: recargas, error: e2 } = await supabase
    .from('billetera_recargas')
    .select('*')
    .ilike('referencia_pago', '%62067%')
    .limit(5);
    
  console.log("recargas:", recargas, e2);
})();
