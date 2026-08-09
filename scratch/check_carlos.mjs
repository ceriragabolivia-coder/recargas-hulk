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

async function checkCarlos() {
  const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY);
  
  const { data, error } = await supabase
    .from('v_clientes_admin')
    .select('nombres, apellidos, rol, roles_adicionales')
    .eq('nombres', 'Carlos')
    .eq('apellidos', 'Nobrega')
    
  console.log(data);
}

checkCarlos();
