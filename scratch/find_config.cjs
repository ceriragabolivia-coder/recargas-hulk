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

async function findAnyConfig() {
    console.log('Finding any config row...');
    const { data, error } = await supabase.from('configuracion').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Count:', data.length);
        console.log('Rows:', data);
    }
}

findAnyConfig();
