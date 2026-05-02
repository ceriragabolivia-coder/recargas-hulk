require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('juegos').select('id, nombre, etiqueta_descuento').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Data:', data);
    }
}

check();
