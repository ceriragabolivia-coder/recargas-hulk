import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('metodos_pago').insert({
    nombre: 'Binance Pay Automático',
    datos: '',
    icono_url: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Binance_Logo.svg',
    activo: true
  });
  console.log(error || 'Success');
}

run();
