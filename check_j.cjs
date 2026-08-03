
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('clientes').select('usuario, nickname, juegos_favoritos').eq('usuario', 'j@gmail.com');
  console.log(data);
}
check();

