const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.vercel', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('clientes').select('*').order('fecha_registro', { ascending: false }).limit(3);
  console.log("Last 3 clientes:", data);
}

run();
