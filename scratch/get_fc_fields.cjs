const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');


// Manual parsing of .env since dotenv might not be fully installed in the global context or we can just read the file
const envFile = fs.readFileSync('C:\\hulk\\app\\.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].replace(/\r$/, '');
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('configuracion').select('valor, valor_texto').eq('clave', 'fazercards_api_key').single();
  const apiKey = data?.valor_texto || data?.valor;
  if (!apiKey) return console.log('No API key found in DB');
  
  const res = await fetch('https://api.fzr.cards/api/v2/topups', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  const json = await res.json();
  if (json.items) {
    const categories = json.items.slice(0, 5).map(c => ({ id: c.id, fields: c.fields }));
    console.log('Categories:', JSON.stringify(categories, null, 2));
    const ff = json.items.find(c => c.id.includes('freefire') || c.name.toLowerCase().includes('free fire'));
    if (ff) console.log('FreeFire Fields:', JSON.stringify(ff.fields, null, 2));
    else console.log('FreeFire category not found');
  } else if (json.categories) {
    const ff = json.categories.find(c => c.id.includes('freefire') || c.name.toLowerCase().includes('free fire'));
    if (ff) console.log('FreeFire Fields:', JSON.stringify(ff.fields, null, 2));
  } else {
    console.log(json);
  }
}
run().catch(console.error);
