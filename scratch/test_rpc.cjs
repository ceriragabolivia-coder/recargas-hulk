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

async function checkRpc() {
    console.log('Testing update_config_rpc with explicit numbers...');
    const { data, error } = await supabase.rpc('update_config_rpc', {
        p_clave: 'test_key_string',
        p_valor: '690',
        p_valor_texto: null,
        p_owner_id: null
    });
    
    if (error) {
        console.error('RPC failed:', error.message);
    } else {
        console.log('RPC succeeded:', data);
    }
}

checkRpc();
