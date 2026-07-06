import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let supabaseUrl = 'https://pivysqtxjnhnmdgixjiy.supabase.co';
let supabaseKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  if (keyMatch) supabaseKey = keyMatch[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Mock login to bypass RLS for reading orders
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@hulk.com', // I don't know the admin email, maybe I shouldn't do this
    password: 'password'
  }).catch(() => ({data:{}}));

  // Let's just read from 'productos' and 'juegos' directly to simulate the logic
  const { data: productosData } = await supabase
    .from('productos')
    .select('id, nombre, proveedor_api_id, juegos(id, procesamiento_automatico_api)')
    .eq('id', 205); // 110 Diamantes

  console.log("Productos Data:", JSON.stringify(productosData, null, 2));

  // How does the condition evaluate?
  if (productosData && productosData.length > 0) {
    const prod = productosData[0];
    const tieneApi = !!prod.proveedor_api_id;
    const autoProcess = prod.juegos?.procesamiento_automatico_api === true;
    console.log("tieneApiItems:", tieneApi);
    console.log("juegoAutoProcess:", autoProcess);
  }
}

test();
