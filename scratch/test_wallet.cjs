const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: users, error: uError } = await supabase.from('clientes').select('auth_user_id, nombres, apellidos').limit(5);
  if(uError) return console.error(uError);

  console.log("Users:", users);

  if(users.length > 0) {
    const user = users[0];
    const { data: bData, error: bError } = await supabase.from('billeteras').select('*').eq('auth_user_id', user.auth_user_id);
    console.log("Wallet for user", user.nombres, ":", bData);
  }
}
run();
