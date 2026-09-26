const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

async function check() {
  try {
    const res = await fetch(urlMatch[1].trim() + '/rest/v1/pedidos?select=numero_pedido,observaciones,cliente_id&limit=1', {
      headers: {
        'apikey': keyMatch[1].trim(),
        'Authorization': 'Bearer ' + keyMatch[1].trim()
      }
    });
    const json = await res.json();
    console.log('JSON:', json);
  } catch (e) {
    console.error(e);
  }
}
check();
