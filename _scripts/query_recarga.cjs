const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'; // I need to get this from env
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRow() {
  const { data, error } = await supabase
    .from('billetera_recargas')
    .select('*')
    .eq('referencia_pago', '453149733135605760');
    
  console.log('Result:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

checkRow();
