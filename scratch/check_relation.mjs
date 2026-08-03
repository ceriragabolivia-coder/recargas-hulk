import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://api.recargashulk.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA');

async function check() {
  const { data, error } = await supabase.from('pedidos').select('*, cliente:clientes(*)').limit(1);
  if (error) {
    console.error('Error with clientes:', error.message);
  } else {
    console.log('Success with clientes:', data[0]?.cliente);
  }
  
  const { data: d2, error: e2 } = await supabase.from('pedidos').select('*, perfiles(*)').limit(1);
  if (e2) {
    console.error('Error with perfiles:', e2.message);
  } else {
    console.log('Success with perfiles:', d2[0]?.perfiles);
  }
}
check();
