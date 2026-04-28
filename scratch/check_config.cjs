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

async function checkConfig() {
    console.log('Checking configuracion table...');
    const { data, error } = await supabase.from('configuracion').select('*');
    if (error) {
        console.error('Error fetching config:', error);
    } else {
        console.log('Config data count:', data.length);
        console.log('Tasa Dolar entry:', data.find(r => r.clave === 'tasa_dolar' && r.owner_id === null));
    }

    console.log('\nChecking update_config_rpc...');
    // We try to update the global tasa_dolar.
    // Note: I shouldn't actually update it with a fake value if I don't want to break the user's app.
    // But I can try to update it to the SAME value it has, or check if I have permission.
}

checkConfig();
