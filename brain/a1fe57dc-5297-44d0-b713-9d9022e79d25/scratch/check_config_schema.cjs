const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('configuracion').select('*').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  console.log('Sample data:', data);
  
  // Try to insert a string to see the error or if it works
  const { error: insertError } = await supabase.from('configuracion').upsert({ clave: 'test_string', valor: 'hello' });
  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Insert worked!');
  }
}

checkSchema();
