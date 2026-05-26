import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data: codigos } = await supabase.from('producto_codigos').select('*');
  console.log('All codigos in DB:', codigos?.length);
  
  if (codigos && codigos.length > 0) {
    const productIds = [...new Set(codigos.map(c => c.producto_id))];
    for (let pid of productIds) {
      const { data: prod } = await supabase.from('productos').select('nombre').eq('id', pid).single();
      const count = codigos.filter(c => c.producto_id === pid).length;
      console.log(`Product ID ${pid} (${prod?.nombre || 'Unknown'}): ${count} codes`);
    }
  }
}
check();
