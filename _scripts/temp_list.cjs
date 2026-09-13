const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
envFile.forEach(line => { 
  const [k,...v] = line.split('='); 
  if(k && v) env[k.trim()] = v.join('=').trim().replace(/['"]/g, ''); 
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() { 
  const { data, error } = await supabase.rpc('get_rpc_list'); 
  if(error) console.log(error);
  console.log(data); 
} 
run();
