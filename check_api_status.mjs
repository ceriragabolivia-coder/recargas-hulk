import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2FvbGtpb29vc21kaWlwbmtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTkxOTY1NiwiZXhwIjoyMDk3NDk1NjU2fQ.GihNB21XQWuMEstWeXL8HoFPHj71BHcKWKRiu8OZ03A'
);

async function checkApi() {
  // 1. Get the API key from configuracion
  const { data: config } = await supabase
    .from('configuracion')
    .select('valor, valor_texto')
    .eq('clave', 'tiendagiftven_api_key')
    .single();

  const apiKey = config?.valor_texto || config?.valor;
  console.log('=== API KEY ===');
  console.log('Exists:', !!apiKey);
  console.log('First 15 chars:', apiKey ? apiKey.substring(0, 15) + '...' : 'N/A');

  if (!apiKey) {
    console.log('❌ No hay API key configurada!');
    return;
  }

  // 2. Check balance
  console.log('\n=== SALDO ===');
  try {
    const balRes = await fetch('https://tiendagiftven.tech/api/v1/saldo', {
      headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
    });
    const balData = await balRes.json();
    console.log('Status:', balRes.status);
    console.log('Response:', JSON.stringify(balData, null, 2));
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // 3. Check products list (just first 3)
  console.log('\n=== PRODUCTOS DISPONIBLES (primeros 5) ===');
  try {
    const prodRes = await fetch('https://tiendagiftven.tech/api/v1/productos', {
      headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
    });
    const prodData = await prodRes.json();
    console.log('Status:', prodRes.status);
    if (prodData.productos) {
      prodData.productos.slice(0, 5).forEach(p => {
        console.log(`  ID: ${p.id} | ${p.nombre} | $${p.precio}`);
      });
      console.log(`  ... (${prodData.productos.length} productos total)`);
    } else {
      console.log(JSON.stringify(prodData, null, 2));
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  // 4. Check a product mapping in our DB
  console.log('\n=== PRODUCTOS CON proveedor_api_id EN NUESTRA DB ===');
  const { data: prods } = await supabase
    .from('productos')
    .select('id, nombre, proveedor_api_id, juego_id')
    .not('proveedor_api_id', 'is', null)
    .limit(10);

  if (prods) {
    prods.forEach(p => {
      console.log(`  DB id:${p.id} | ${p.nombre} | proveedor_api_id: ${p.proveedor_api_id}`);
    });
  }
}

checkApi();
