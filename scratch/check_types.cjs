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

async function checkTypes() {
    console.log('Checking configuracion table columns...');
    // Since I can't call RPCs to get schema, I'll try to guess by selecting
    const { data, error } = await supabase.from('configuracion').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('First row:', data[0]);
        console.log('Types of values in first row:');
        Object.keys(data[0]).forEach(key => {
            console.log(`${key}: ${typeof data[0][key]} (value: ${data[0][key]})`);
        });
    } else {
        console.log('Table is empty');
    }
}

checkTypes();
