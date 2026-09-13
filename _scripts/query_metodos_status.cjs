const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const envUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const envKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(envUrl, envKey);

async function run() {
  const { data, error } = await supabase.from('metodos_pago').select('id, nombre, activo, habilitado_billetera, habilitado_billetera_bs');
  console.log(JSON.stringify(data, null, 2));
}
run();
