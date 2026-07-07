import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function main() {
  const { data, error } = await supabase.from('pedido_items').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0] || {}));
}
main();
