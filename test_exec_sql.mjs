import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const envConfig = {};
envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envConfig[key.trim()] = valueParts.join('=').trim();
    }
});

async function checkDb() {
  const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);
  console.log("🔍 Checking Order #666 using exec_sql...");
  
  const { data: orders, error } = await supabase.rpc('exec_sql', { p_sql: "SELECT p.id as pedido_id, p.numero_pedido, p.estado, pi.id as item_id, pi.estado as item_estado, pi.estado_proveedor, pi.proveedor_pedido_id FROM public.pedidos p JOIN public.pedido_items pi ON p.id = pi.pedido_id WHERE p.numero_pedido = 666" });
  if (error) {
    console.error(`❌ Error executing: `, error.message);
    return;
  }
  console.log(orders);
}

checkDb();
