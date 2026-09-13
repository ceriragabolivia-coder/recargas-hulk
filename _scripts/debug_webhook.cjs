const { createClient } = require('@supabase/supabase-js');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function debug() {
  console.log("Buscando ultimos pedidos...");
  
  const { data: pedidos, error: pErr } = await supabase
    .from('pedidos')
    .select('id, numero_pedido')
    .order('id', { ascending: false })
    .limit(5);
    
  if (pErr || !pedidos) {
    console.error("Error buscando pedido:", pErr);
    return;
  }
  
  console.log("Pedidos recientes:", pedidos);
  
  const p1547 = pedidos.find(p => p.numero_pedido === 1547 || p.numero_pedido === '1547' || p.numero_pedido === '001547');
  if (!p1547) {
      console.log("No se encontro 1547. Usaremos el primero:", pedidos[0]);
      var targetId = pedidos[0].id;
  } else {
      var targetId = p1547.id;
  }
  
  const { data: items, error: iErr } = await supabase
    .from('pedido_items')
    .select('id, estado')
    .eq('pedido_id', targetId);
    
  if (iErr || !items || items.length === 0) {
    console.error("Error buscando items:", iErr);
    return;
  }
  
  const itemId = items[0].id;
  console.log("Item ID encontrado para probar:", itemId, "- Estado actual:", items[0].estado);
  
  console.log("Simulando llamada al RPC del Webhook...");
  const payload = {
    p_merchant_ref: 'HULK-ITEM-' + itemId,
    p_pedido_id: 371037,
    p_estado: 'completado',
    p_mensaje: '6383328807'
  };
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('procesar_webhook_tiendagiftven_rpc', payload);
  
  if (rpcError) {
    console.error("❌ EL RPC FALLÓ CON ERROR:", rpcError);
  } else {
    console.log("✅ EL RPC SE EJECUTÓ CORRECTAMENTE:", rpcData);
  }
}

debug();
