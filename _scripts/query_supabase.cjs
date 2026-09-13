require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: jData, error: jErr } = await supabase.from('juegos').select('*').limit(1);
  console.log('Juegos columns:', jData ? Object.keys(jData[0]) : jErr);
  const { data: pData, error: pErr } = await supabase.from('productos').select('*').limit(1);
  console.log('Productos columns:', pData ? Object.keys(pData[0]) : pErr);
}
run();
