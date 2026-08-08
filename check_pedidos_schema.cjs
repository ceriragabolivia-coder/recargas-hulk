const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
envFile.forEach(line => { 
  const [k,...v] = line.split('='); 
  if(k && v) env[k.trim()] = v.join('=').trim().replace(/['"]/g, ''); 
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('pedidos').select('*').limit(1);
  if (data && data.length > 0) console.log(Object.keys(data[0]));
}
run();
