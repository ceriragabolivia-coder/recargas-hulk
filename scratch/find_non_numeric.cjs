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

async function findNonNumeric() {
    console.log('Finding rows with non-numeric values in "valor" column...');
    // Since I can't select easily, I'll use a trick: 
    // Try to select rows where valor * 1 succeeds. If it fails, I'll try to find which one.
    // Wait, I can't do that.
    
    // I'll try to select all keys and then check them one by one in JS.
    const { data, error } = await supabase.from('configuracion').select('clave, valor');
    if (error) {
        console.error('Error selecting keys:', error.message);
    } else {
        console.log(`Found ${data.length} keys.`);
        data.forEach(r => {
            const num = Number(r.valor);
            if (isNaN(num)) {
                console.log(`❌ Non-numeric found: clave="${r.clave}", valor="${r.valor}"`);
            }
        });
    }
}

findNonNumeric();
