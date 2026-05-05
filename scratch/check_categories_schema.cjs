const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('categorias').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Columns in categorias:', Object.keys(data[0] || {}));
  }
}

checkSchema();
