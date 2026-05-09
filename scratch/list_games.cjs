
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(process.cwd(), '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const envConfig = {};
envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envConfig[key.trim()] = valueParts.join('=').trim();
    }
});

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function listJuegos() {
    console.log('--- Juegos Table ---');
    const { data, error } = await supabase
        .from('juegos')
        .select('id, nombre, activo, mostrar_en_landing, icono_url')
        .eq('activo', true)
        .order('nombre');
    
    if (error) {
        console.error(error);
    } else {
        console.table(data);
    }

    console.log('--- Categorias Table ---');
    const { data: catData, error: catError } = await supabase
        .from('categorias')
        .select('id, nombre, activa, orden');
    
    if (catError) {
        console.error(catError);
    } else {
        console.table(catData);
    }
}

listJuegos();
