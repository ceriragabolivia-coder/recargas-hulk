import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const envConfig = {};
envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envConfig[key.trim()] = valueParts.join('=').trim();
    }
});

async function checkHistory() {
  const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);
  
  const { data: history, error } = await supabase.rpc('exec_sql', { p_sql: "SELECT bh.*, p.nombre FROM public.billetera_historial bh JOIN public.perfiles p ON bh.usuario_id = p.id WHERE p.nombre ILIKE '%Celia%' ORDER BY bh.created_at ASC" });
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('History:');
  console.table(history.map(h => ({
    id: h.id,
    fecha: new Date(h.created_at).toLocaleString(),
    tipo: h.tipo,
    monto: h.monto,
    saldo_anterior: h.saldo_anterior,
    saldo_posterior: h.saldo_posterior
  })));
}

checkHistory();
