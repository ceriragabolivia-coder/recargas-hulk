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

async function getColumnTypes() {
    console.log('Fetching column types from information_schema...');
    // We can't query information_schema directly easily via REST if not exposed,
    // but we can try to select from a view if we create one.
    // However, I'll try to just check the JS types of the returned data again, 
    // but this time I'll use a test key that I know exists or create one.
    
    const { data, error } = await supabase.from('configuracion').select('valor, valor_texto').eq('clave', 'tasa_dolar').limit(1);
    
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Row for tasa_dolar:', data[0]);
        console.log('valor type in JS:', typeof data[0].valor);
        console.log('valor_texto type in JS:', typeof data[0].valor_texto);
    } else {
        console.log('tasa_dolar not found');
    }
}

getColumnTypes();
