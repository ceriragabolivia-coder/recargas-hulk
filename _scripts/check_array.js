import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .limit(1)
    .single();

  if (pedido) {
    const item = pedido.pedido_items[0];
    console.log('Is Array?', Array.isArray(item.productos));
    console.log('Productos:', item.productos);
  }
}
check();
