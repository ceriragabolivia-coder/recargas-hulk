import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  await supabase.auth.signInWithPassword({
    email: 'admin@ceriraga.com',
    password: 'admin'
  }); // Note: This failed earlier, so it will run as anon!
  
  // Let's try to query products named "PSN 1$ USD"
  const { data: prods } = await supabase.from('productos').select('id, nombre').eq('nombre', 'PSN 1$ USD');
  console.log('Products:', prods);
  
  if (prods && prods.length > 0) {
    for (let p of prods) {
       const { data: codigos } = await supabase.from('producto_codigos').select('*').eq('producto_id', p.id);
       console.log(`Codigos for product ${p.id}:`, codigos?.length, codigos);
    }
  }
  
  // Also let's check order 505
  const { data: ped } = await supabase.from('pedidos').select('*, pedido_items(*)').eq('numero_pedido', 505);
  console.log('Pedido 505:', ped);
}
check();
