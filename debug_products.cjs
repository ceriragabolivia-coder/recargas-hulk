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

async function checkProducts() {
  console.log(`Fetching products...`);
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, icono_url')
    .order('nombre')
    .limit(10);

  if (error) {
    console.error("Error fetching products:", error);
    return;
  }

  data.forEach(p => {
    console.log(`Product: ${p.nombre} (ID: ${p.id})`);
    console.log(`  - icono_url: "${p.icono_url}"`);
  });
}

checkProducts();
