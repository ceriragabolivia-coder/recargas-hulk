const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://api.recargashulk.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA');

async function test() {
  console.log('Testing...');

  const { data: cols, error: errCols } = await supabase.rpc('get_table_columns', { table_name: 'producto_codigos' }).select();
  if (errCols) {
    console.log('Cannot get columns using RPC, trying a select instead.');
    const { data: selData, error: selErr } = await supabase.from('producto_codigos').select('*').limit(1);
    console.log('Select 1 row:', selData, selErr);
  } else {
    console.log('Columns:', cols);
  }
}

test();
