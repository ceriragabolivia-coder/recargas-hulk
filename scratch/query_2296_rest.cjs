const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env.local', 'utf8');
  let urlMatch = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (!urlMatch) urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\r\n]+)["']?/);
  
  let keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)["']?/);
  if (!keyMatch) keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=["']?([^"'\r\n]+)["']?/);
  
  const headers = {
    'apikey': keyMatch[1].trim(),
    'Authorization': `Bearer ${keyMatch[1].trim()}`
  };

  const fetch = require('node-fetch');
  
  // 1. Get pedido
  const pRes = await fetch(`${urlMatch[1].trim()}/rest/v1/pedidos?numero_pedido=eq.2296&select=*`, { headers });
  const pData = await pRes.json();
  
  if (!pData || pData.length === 0) return console.log('Pedido no encontrado');
  const pedido = pData[0];
  
  // 2. Get items
  const iRes = await fetch(`${urlMatch[1].trim()}/rest/v1/pedido_items?pedido_id=eq.${pedido.id}&select=*`, { headers });
  const items = await iRes.json();

  console.log(JSON.stringify({ pedido, items }, null, 2));
}
run();
