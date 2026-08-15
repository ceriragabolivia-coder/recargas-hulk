const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://api.recargashulk.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA'
);

(async () => {
  const { data: result, error: rpcError } = await supabase.rpc('intentar_auto_aprobar_recarga_rpc', {
    p_recarga_id: '00000000-0000-0000-0000-000000000000',
    p_referencia: 'test',
    p_monto: 100,
    p_usuario_id: '00000000-0000-0000-0000-000000000000',
    p_ocr_referencia: null
  });
  console.log("Result:", result, "Error:", rpcError);
})();
