const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const lines = env.split('\n');
const process_env = {};
lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process_env[key.trim()] = value.trim();
});

const supabase = createClient(process_env.VITE_SUPABASE_URL, process_env.VITE_SUPABASE_ANON_KEY);

async function debugRpc() {
    console.log('Debugging update_config_rpc with detailed error handling...');
    
    // Test 1: Global update
    console.log('Testing global update...');
    const res1 = await supabase.rpc('update_config_rpc', {
        p_clave: 'tasa_dolar',
        p_valor: 690,
        p_valor_texto: null,
        p_owner_id: null
    });
    if (res1.error) {
        console.error('Test 1 failed:', res1.error.message, res1.error.details, res1.error.hint);
    } else {
        console.log('Test 1 succeeded:', res1.data);
    }
}

debugRpc();
