const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const {data: p} = await supabase.from('perfiles').select('*').limit(1);
  console.log('Perfiles:', p ? Object.keys(p[0]) : null);
  
  const {data: c} = await supabase.from('clientes').select('*').limit(1);
  console.log('Clientes:', c ? Object.keys(c[0]) : null);
}
check();
