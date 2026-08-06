import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const serviceRole = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const finalKey = serviceRole ? serviceRole[1].trim() : key;

const supabase = createClient(url, finalKey);

async function checkFidel() {
  const { data: tx, error: err1 } = await supabase.from('billetera_transacciones')
    .select('auth_user_id').eq('monto', -637);
    
  if (err1 || !tx || tx.length === 0) { console.error('Transaction not found', err1); return; }
  
  const auth_user_id = tx[0].auth_user_id;
  console.log('User ID:', auth_user_id);
  
  // Get wallet balance
  const { data: wallet, error: err2 } = await supabase.from('billeteras')
    .select('*').eq('auth_user_id', auth_user_id).single();
    
  console.log('Current Wallet:', wallet);
  
  // Get all transactions
  const { data: txs, error: err3 } = await supabase.from('billetera_transacciones')
    .select('*').eq('auth_user_id', auth_user_id).order('created_at', { ascending: false });
    
  let currentBs = wallet.saldo_bs;
  for (let t of txs) {
    if (t.moneda === 'bs') {
      console.log(`Time: ${t.created_at}, Tipo: ${t.tipo}, Monto: ${t.monto}, Desc: ${t.descripcion}, BalPosterior: ${currentBs}`);
      currentBs -= t.monto;
    }
  }
}
checkFidel();
