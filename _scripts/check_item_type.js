import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data: itemData, error: itemError } = await supabase.from('pedido_items').select('id, pedido_id, producto_id').limit(1);
  console.log("pedido_items ID:", itemData);
}
check();
