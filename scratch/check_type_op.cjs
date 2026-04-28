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

async function checkTypeDetailed() {
    console.log('Checking column "valor" type using numeric operation...');
    // If it's text, this will fail with "operator does not exist: text + integer"
    const { data, error } = await supabase.from('configuracion').select('valor').limit(1);
    
    if (error) {
        console.log('Select failed:', error.message);
    } else if (data && data.length > 0) {
        const val = data[0].valor;
        console.log('Value:', val, 'Type in JS:', typeof val);
        
        // Try a remote operation that would fail on text
        const { error: opError } = await supabase.from('configuracion').select('id').gt('valor', 0).limit(1);
        if (opError) {
            console.log('Remote GT operation failed:', opError.message);
        } else {
            console.log('Remote GT operation succeeded. It is NUMERIC.');
        }
    }
}

checkTypeDetailed();
