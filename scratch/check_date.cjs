
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkOrderDate() {
  const { data, error } = await supabase.from('pedidos').select('numero_pedido, created_at').order('created_at', { ascending: false }).limit(1).single();
  if (error) console.error(error);
  else {
    console.log('Last Order:', data);
    const d = new Date(data.created_at);
    console.log('Local string (system):', d.toLocaleString());
    console.log('Caracas string:', d.toLocaleString('es-VE', { timeZone: 'America/Caracas' }));
  }
}

checkOrderDate();
