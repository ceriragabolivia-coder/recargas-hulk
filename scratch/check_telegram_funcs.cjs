const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkFunctions() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    p_sql: "SELECT proname, prosrc FROM pg_proc WHERE proname ILIKE '%telegram%' OR prosrc ILIKE '%telegram%';" 
  });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkFunctions();
