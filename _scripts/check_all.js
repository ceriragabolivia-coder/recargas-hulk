import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { error: e1 } = await supabase.from('ventas').select('pedido_id').eq('pedido_id', 'not-a-uuid');
  console.log('ventas.pedido_id:', e1);
  
  const { error: e2 } = await supabase.from('producto_codigos').select('pedido_id').eq('pedido_id', 'not-a-uuid');
  console.log('producto_codigos.pedido_id:', e2);
  
  const { error: e3 } = await supabase.from('producto_codigos').select('id').eq('id', 'not-a-uuid');
  console.log('producto_codigos.id:', e3);
}
check();
