import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const email = `test_${Date.now()}@test.com`;
  await supabase.auth.signUp({email, password: 'password123'});
  await supabase.auth.signInWithPassword({email, password: 'password123'});
  
  const { data: pData } = await supabase.from('pedidos').insert({
    numero_pedido: 99999,
    estado: 'pendiente'
  }).select().single();
  
  const { data: piData } = await supabase.from('pedido_items').insert({
    pedido_id: pData.id,
    producto_id: 149,
    cantidad: 1
  }).select().single();
  
  console.log('Pedido ID type:', typeof pData.id, pData.id);
  console.log('Pedido Item ID type:', typeof piData.id, piData.id);
}
check();
