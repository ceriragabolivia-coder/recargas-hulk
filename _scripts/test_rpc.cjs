const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://api.recargashulk.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA'
);

(async () => {
  const { data: cliente, error } = await supabase
    .from('perfiles')
    .select('id, rol')
    .ilike('rol', '%admin%')
    .limit(1)
    .single();
    
  console.log("Perfil admin:", cliente, error);
  if (cliente?.id) {
     const { data, error: rpcErr } = await supabase.rpc('get_admin_counts_rpc', { p_user_id: cliente.id });
     console.log("Counts:", data, rpcErr);
  }
})();
