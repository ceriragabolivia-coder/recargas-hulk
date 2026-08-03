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

async function testWebhook() {
  const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);
  
  // Buscar un item real del pedido
  const { data: pedido } = await supabase.from('pedidos').select('id, numero_pedido').order('id', { ascending: false }).limit(1).single();
  if (!pedido) {
    console.log("No se encontró ningún pedido");
    return;
  }
  
  const { data: items } = await supabase.from('pedido_items').select('*').eq('pedido_id', pedido.id);
  if (!items || items.length === 0) {
    console.log("No items found");
    return;
  }
  
  const itemId = items[0].id;
  console.log(`Probando webhook con item ID: ${itemId} (Pedido ${pedido.numero_pedido})`);
  
  const updateData = {
    estado_proveedor: 'aprobado',
    estado: 'completado',
  };

  const { error: itemUpdateError } = await supabase
    .from('pedido_items')
    .update(updateData)
    .eq('id', itemId);

  console.log('Update result:', itemUpdateError || 'SUCCESS (no error object)');
  
  // Select to check all items
  const { data: allItems, error: allErr } = await supabase
    .from('pedido_items')
    .select('*')
    .eq('pedido_id', pedido.id);
    
  console.log('Select allItems result:', allErr || `Found ${allItems?.length} items`);
}

testWebhook();
