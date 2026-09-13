const fs = require('fs');
let env = {};
try {
  env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match) acc[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
    return acc;
  }, {});
} catch (e) {
  env = process.env;
}

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('configuracion').select('valor_texto').eq('clave', 'tiendagiftven_api_key').single();
  if (error) {
    console.error("Error reading config:", error);
    return;
  }
  const apiKey = data.valor_texto;
  console.log("Found API Key:", apiKey.substring(0, 10) + '...');
  
  // Register webhook
  const res = await fetch('https://tiendagiftven.tech/api/v1/webhook', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: "https://recargashulk.com/api/tiendagiftven/webhook" })
  });
  const json = await res.json();
  console.log("Webhook registration result:", json);
}
run();
