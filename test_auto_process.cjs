const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function check() {
  const { data: pedidoConItems } = await supabase
      .from('pedidos')
      .select('pedido_items(*, productos(proveedor_api_id, juego_id, juegos(procesamiento_automatico_api)))')
      .eq('id', 107)
      .single();
  
  console.log('pedidoConItems:', JSON.stringify(pedidoConItems, null, 2));

  const tieneApiItems = pedidoConItems?.pedido_items?.some(
    i => i.productos?.proveedor_api_id
  );
  const juegoAutoProcess = pedidoConItems?.pedido_items?.some(
    i => i.productos?.juegos?.procesamiento_automatico_api === true
  );

  console.log({ tieneApiItems, juegoAutoProcess });
}
check();
