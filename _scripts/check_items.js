import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/);

async function check() {
  let supabase;
  if (key) {
    supabase = createClient(url, key[1].trim());
  } else {
    // If no service key, we must use anon but it might fail
    supabase = createClient(url, env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim());
    await supabase.auth.signInWithPassword({ email: 'ceriraga@gmail.com', password: 'admin' }).catch(() => {});
  }
  
  const { data: items } = await supabase.from('pedido_items').select('id, pedido_id, producto_id').limit(1);
  console.log('Items:', items);
}
check();
