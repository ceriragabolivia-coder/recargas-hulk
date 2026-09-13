import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function main() {
  const { data } = await supabase.from('pedido_items').select('*').order('id', { ascending: false }).limit(1);
  console.log(JSON.stringify(data, null, 2));
}
main();
