
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

async function probe() {
    console.log('--- Probing admin_saldos_historial.pedido_id ---');
    const { error: uuidErr } = await supabase.from('admin_saldos_historial').insert({ 
        admin_id: '00000000-0000-0000-0000-000000000000', 
        pedido_id: '00000000-0000-0000-0000-000000000000',
        tipo_movimiento: 'credito_venta',
        moneda: 'usd',
        monto: 0
    });
    console.log('Insert with UUID error:', JSON.stringify(uuidErr));

    const { error: intErr } = await supabase.from('admin_saldos_historial').insert({ 
        admin_id: '00000000-0000-0000-0000-000000000000', 
        pedido_id: 99999,
        tipo_movimiento: 'credito_venta',
        moneda: 'usd',
        monto: 0
    });
    console.log('Insert with INT error:', JSON.stringify(intErr));
}

probe();
