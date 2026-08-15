const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://api.recargashulk.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA'
);

(async () => {
  const { data: apk, error: e1 } = await supabase
    .from('pagos_apk')
    .select('*')
    .ilike('referencia', '%83169%')
    .limit(5);
    
  console.log("pagos_apk:", apk, e1);
  
  const { data: recargas, error: e2 } = await supabase
    .from('billetera_recargas')
    .select('*')
    .ilike('referencia_pago', '%83169%')
    .limit(5);
    
  console.log("recargas:", recargas, e2);
})();
