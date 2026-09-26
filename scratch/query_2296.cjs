const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

async function check() {
  try {
    const res = await fetch(urlMatch[1].trim().replace(/['"]/g, '') + '/rest/v1/pedidos?select=*&limit=1', {
      headers: {
        'apikey': keyMatch[1].trim().replace(/['"]/g, ''),
        'Authorization': 'Bearer ' + keyMatch[1].trim().replace(/['"]/g, '')
      }
    });
    const json = await res.json();
    console.log(Object.keys(json[0] || {}));
  } catch (e) {
    console.error(e);
  }
}
check();
