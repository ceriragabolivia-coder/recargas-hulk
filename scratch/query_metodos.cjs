const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Intentar leer de .env
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('metodos_pago').select('*');
  console.log(JSON.stringify(data, null, 2));
}
run();
