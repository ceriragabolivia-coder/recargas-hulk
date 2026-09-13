
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manually parse .env
const envPath = path.join(process.cwd(), '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const envConfig = {};
envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envConfig[key.trim()] = valueParts.join('=').trim();
    }
});

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function verify() {
    console.log('--- Verificando registrar_venta_rpc con p_pedido_id como INT ---');
    const { data: vData, error: vError } = await supabase.rpc('registrar_venta_rpc', {
        p_producto_id: 1,
        p_pedido_id: 9999 // Pass as INT
    });
    console.log('Response:', JSON.stringify(vData), JSON.stringify(vError));
    
    console.log('\n--- Verificando registrar_actividad_usuario ---');
    const { data: aData, error: aError } = await supabase.rpc('registrar_actividad_usuario', {
        p_tipo: 'test_verify',
        p_session_id: 'session_123'
    });
    console.log('Response:', JSON.stringify(aData), JSON.stringify(aError));
}

verify();
