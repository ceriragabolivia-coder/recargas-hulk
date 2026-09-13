import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2FvbGtpb29vc21kaWlwbmtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTkxOTY1NiwiZXhwIjoyMDk3NDk1NjU2fQ.GihNB21XQWuMEstWeXL8HoFPHj71BHcKWKRiu8OZ03A'
);

async function debug() {
  // 1. Get order 123 with items
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .eq('numero_pedido', '000123')
    .single();

  console.log('=== PEDIDO #000123 ===');
  console.log('Estado:', pedido?.estado);
  console.log('Items:', pedido?.pedido_items?.length);

  for (const item of (pedido?.pedido_items || [])) {
    const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    console.log('\n--- ITEM ---');
    console.log('Item ID:', item.id);
    console.log('Producto:', prod?.nombre);
    console.log('proveedor_api_id:', prod?.proveedor_api_id);
    console.log('player_id:', item.player_id);
    console.log('zone_id:', item.zone_id);
    console.log('estado_proveedor:', item.estado_proveedor);
    console.log('mensaje_proveedor:', item.mensaje_proveedor);
    console.log('proveedor_pedido_id:', item.proveedor_pedido_id);
  }

  // 2. Get API key and simulate the exact same call
  const { data: config } = await supabase
    .from('configuracion')
    .select('valor, valor_texto')
    .eq('clave', 'tiendagiftven_api_key')
    .single();
  const apiKey = config?.valor_texto || config?.valor;

  if (pedido?.pedido_items?.[0]) {
    const item = pedido.pedido_items[0];
    const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    
    if (prod?.proveedor_api_id) {
      console.log('\n=== SIMULANDO LLAMADA A TIENDAGIFTVEN ===');
      const payload = {
        producto_id: parseInt(prod.proveedor_api_id, 10),
        merchant_ref: `HULK-ITEM-${item.id}`
      };

      if (item.player_id) {
        payload.id_juego = String(item.player_id).trim();
        if (item.zone_id) payload.input2 = String(item.zone_id).trim();
      } else {
        payload.cantidad = item.cantidad || 1;
      }

      console.log('Payload:', JSON.stringify(payload, null, 2));

      // DON'T actually call the API - just show what would be sent
      console.log('\n(No se hace la llamada real para no gastar saldo)');
      
      // But let's check if the product exists
      const prodRes = await fetch('https://tiendagiftven.tech/api/v1/productos', {
        headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
      });
      const prodData = await prodRes.json();
      const matchingProd = prodData.productos?.find(p => p.id === parseInt(prod.proveedor_api_id, 10));
      
      if (matchingProd) {
        console.log('\n✅ Producto encontrado en TiendaGiftVen:');
        console.log(JSON.stringify(matchingProd, null, 2));
      } else {
        console.log(`\n❌ Producto con ID ${prod.proveedor_api_id} NO ENCONTRADO en TiendaGiftVen!`);
        console.log('IDs disponibles similares:');
        prodData.productos?.filter(p => p.nombre?.toLowerCase().includes('diamante')).slice(0, 5).forEach(p => {
          console.log(`  ID: ${p.id} | ${p.nombre} | $${p.precio}`);
        });
      }
    }
  }
}

debug();
