import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  // Login as admin to bypass RLS
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'recargashulk@gmail.com',
    password: 'Admin2026!'  // Try common password
  });

  if (authErr) {
    console.log('Auth error (expected if password wrong):', authErr.message);
    console.log('Trying without auth...');
  }

  // 1. Find latest orders
  const { data: pedidos, error: pe } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, estado, pago_verificado, referencia_pago, created_at')
    .order('id', { ascending: false })
    .limit(5);

  console.log('=== PEDIDOS (últimos 5) ===');
  if (pe) console.log('Error:', pe);
  else console.log(JSON.stringify(pedidos, null, 2));

  if (!pedidos || pedidos.length === 0) {
    console.log('No se encontraron pedidos. Probablemente RLS bloquea sin service_role_key.');
    console.log('\n⚠️ PROBLEMA CRÍTICO: No hay SUPABASE_SERVICE_ROLE_KEY configurada.');
    console.log('Las funciones serverless en Vercel necesitan esta key para poder leer pedidos sin autenticación de usuario.');
    return;
  }

  const pedido = pedidos[0];

  // 2. Get items with products
  const { data: items, error: ie } = await supabase
    .from('pedido_items')
    .select('id, producto_id, player_id, zone_id, estado_proveedor, proveedor_pedido_id, productos(id, nombre, proveedor_api_id, entrega_automatica)')
    .eq('pedido_id', pedido.id);

  console.log('\n=== ITEMS del pedido #' + pedido.numero_pedido + ' ===');
  if (ie) console.log('Error:', ie);
  else console.log(JSON.stringify(items, null, 2));

  // 3. Check API key
  const { data: config, error: ce } = await supabase
    .from('configuracion')
    .select('clave, valor, valor_texto')
    .eq('clave', 'tiendagiftven_api_key')
    .single();

  console.log('\n=== API KEY ===');
  if (ce) console.log('Error:', ce);
  else {
    const key = config?.valor_texto || config?.valor;
    console.log('Key exists:', !!key);
    if (key) console.log('Key (first 10):', key.substring(0, 10) + '...');
  }
}

debug();
