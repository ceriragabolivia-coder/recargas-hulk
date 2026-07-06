import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let supabaseUrl = 'https://pivysqtxjnhnmdgixjiy.supabase.co';
let supabaseKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  if (keyMatch) supabaseKey = keyMatch[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, juego_id, juegos(id)')
    .limit(1);

  console.log("juegos Data:", JSON.stringify(data, null, 2));
  console.log("juegos Error:", error);

  const { data: d2, error: e2 } = await supabase
    .from('productos')
    .select('id, juego_id, juego(id)')
    .limit(1);

  console.log("juego Data:", JSON.stringify(d2, null, 2));
  console.log("juego Error:", e2);
}

test();
