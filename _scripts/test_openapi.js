import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
async function test() {
  const res = await fetch(url + '/rest/v1/', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const json = await res.json();
  const def = json.definitions.billeteras;
  console.log(JSON.stringify(def, null, 2));
}
test();
