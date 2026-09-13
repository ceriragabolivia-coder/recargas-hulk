const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fix() {
  const res = await supabase.from('pedido_items').update({
    estado_proveedor: 'completado',
    estado: 'completado',
    proveedor_pedido_id: '214408'
  }).eq('id', 121);
  console.log('Fixed item 121:', res);
  
  const res2 = await supabase.from('pedidos').update({
    estado: 'completado',
    venta_registrada: true
  }).eq('id', 107);
  console.log('Fixed pedido 107:', res2);
}
fix();
