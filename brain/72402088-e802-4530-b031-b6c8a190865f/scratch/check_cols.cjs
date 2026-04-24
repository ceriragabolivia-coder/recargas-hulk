const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCols() {
  const { data, error } = await supabase.from('clientes').select('*').limit(1);
  if (error) console.error(error);
  else if (data.length > 0) console.log('Columns in clientes:', Object.keys(data[0]));
}

checkCols();
