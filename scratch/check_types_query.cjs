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

async function checkMetadata() {
    console.log('Checking column types via RPC...');
    // I'll try to use a simple query that will fail if types are wrong
    const { data, error } = await supabase.from('configuracion').select('valor').gt('valor', 0).limit(1);
    
    if (error) {
        console.log('Query failed:', error.message);
        if (error.message.includes('operator does not exist: text > integer')) {
            console.log('CONFIRMED: Column "valor" is TEXT');
        } else {
            console.log('Error was something else.');
        }
    } else {
        console.log('Query succeeded. Column "valor" is likely numeric.');
    }
}

checkMetadata();
