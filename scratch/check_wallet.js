import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: users, error: uError } = await supabase.from('clientes').select('auth_user_id, nombres, apellidos').limit(5);
  if(uError) return console.error("Error fetching users:", uError);

  if(users.length > 0) {
    const user = users[0];
    console.log("Testing with user:", user.nombres, user.auth_user_id);
    
    // Check current wallet
    const { data: wallet1 } = await supabase.from('billeteras').select('*').eq('auth_user_id', user.auth_user_id);
    console.log("Wallet before:", wallet1);

    // Call RPC
    console.log("Calling ajustar_saldo_billetera_bs_rpc with 2500");
    const { data: rpcData, error: rpcError } = await supabase.rpc('ajustar_saldo_billetera_bs_rpc', {
      p_user_id: user.auth_user_id,
      p_admin_id: user.auth_user_id, // fake admin id
      p_nuevo_saldo: 2500,
      p_nota: 'test'
    });
    console.log("RPC result:", rpcData, "Error:", rpcError);

    // Check wallet after
    const { data: wallet2 } = await supabase.from('billeteras').select('*').eq('auth_user_id', user.auth_user_id);
    console.log("Wallet after:", wallet2);
  }
}
run();
