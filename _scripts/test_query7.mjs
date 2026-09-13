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
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
  if (keyMatch) supabaseKey = keyMatch[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(proveedor_api_id, juego_id, juegos(procesamiento_automatico_api)))')
    .eq('id', 96)
    .single();

  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

test();
