const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data: configRow } = await supabase
        .from('configuracion')
        .select('valor, valor_texto')
        .eq('clave', 'tiendagiftven_api_key')
        .single();
  console.log('apiKey config:', configRow);
}
check();
