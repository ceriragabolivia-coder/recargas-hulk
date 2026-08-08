const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.vercel', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function test() {
  const p_pedido_data = {
    cliente_id: '158e9999-52e8-4683-9b97-152e67300c3b', // I need a valid client ID. Let's just pass null and let it fail? No, it will fail.
  };
  
}
test();
