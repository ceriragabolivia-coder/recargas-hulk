const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
  
  const url = `${urlMatch[1].trim()}/rest/v1/pedido_items?pedido_id=eq.1364&select=*`;
  
  const fetch = require('node-fetch');
  const res = await fetch(url, {
    headers: {
      'apikey': keyMatch[1].trim(),
      'Authorization': `Bearer ${keyMatch[1].trim()}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
