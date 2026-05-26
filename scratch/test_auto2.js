import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.rpc('debug_sql', { query: "SELECT prosrc FROM pg_proc WHERE proname = 'guardar_historial_tasas'" });
  console.log("Trigger Code:", data);
  console.log("ERROR:", error);
}
check();
