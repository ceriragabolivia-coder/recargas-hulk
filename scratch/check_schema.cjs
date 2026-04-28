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

async function checkSchema() {
    console.log('Checking column types via information_schema...');
    // We can't query information_schema directly with anon key usually, 
    // but maybe we have a view or we can use the JS SDK's metadata if it exists.
    // Actually, I'll try to just select one row and see the result type in JS.
    const { data, error } = await supabase.from('configuracion').select('*').limit(1);
    if (error) {
        console.error('Error selecting:', error);
    } else {
        console.log('Data:', data);
    }
}

checkSchema();
