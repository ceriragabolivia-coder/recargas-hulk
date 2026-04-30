
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

async function checkTypes() {
    // We try to use a trick to get types via PostgREST metadata if available, 
    // or just try to insert a record and see the error.
    // Better yet, use rpc to call a function that doesn't exist to see if we get a list of functions?
    // No, let's just try to select from a system view if allowed (probably not).
    
    // Let's try to see the structure of a successful select
    const { data: cols, error: colError } = await supabase.from('pedidos').select('*').limit(0);
    console.log('Columns in pedidos:', Object.keys(cols?.[0] || {}));
    
    // Check registrar_venta_rpc existence with more parameters
    const { data: rpcData, error: rpcError } = await supabase.rpc('registrar_venta_rpc', {
        p_producto_id: 1,
        p_cantidad: 1,
        p_notas: 'test',
        p_cliente_id: '00000000-0000-0000-0000-000000000000',
        p_metodo_pago_id: '00000000-0000-0000-0000-000000000000',
        p_referencia_pago: 'test',
        p_player_id: 'test',
        p_account_email: 'test',
        p_account_password: 'test',
        p_vendedor_id: '00000000-0000-0000-0000-000000000000',
        p_pedido_id: '00000000-0000-0000-0000-000000000000',
        p_owner_id: '00000000-0000-0000-0000-000000000000'
    });
    console.log('RPC Test Response (Full Params):', JSON.stringify(rpcData), JSON.stringify(rpcError));
}

checkTypes();
