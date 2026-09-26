const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We will fetch credentials from the code itself since we can read env files
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data } = await supabase.from('pedido_items').select('*').eq('pedido_id', 1364);
  console.log(data);
}
run();
