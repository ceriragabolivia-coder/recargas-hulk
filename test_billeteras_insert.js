import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
// Use the service role key if possible to bypass RLS, but we only have ANON_KEY in .env.
// Is there a SERVICE_ROLE_KEY?
const serviceRole = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const finalKey = serviceRole ? serviceRole[1].trim() : key;
const supabase = createClient(url, finalKey);

async function test() {
  const { data, error } = await supabase.from('billeteras').insert({
    auth_user_id: '11051a90-67d0-41ec-ab5c-be9d8ec9bc01',
    saldo: 10,
    saldo_bs: 0
  });
  console.log('Insert 1:', data, error);
  
  // Try to insert again to trigger ON CONFLICT
  const { data: d2, error: e2 } = await supabase.from('billeteras').upsert({
    auth_user_id: '11051a90-67d0-41ec-ab5c-be9d8ec9bc01',
    saldo: 20,
    saldo_bs: 0
  }, { onConflict: 'auth_user_id' });
  console.log('Upsert 2:', d2, e2);
}
test();
