const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = process.env.SUPABASE_URL || 'https://vdyjtwvpsxvxuzclnllq.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function probe() {
  // 1. Buscar al usuario joskds
  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .ilike('usuario', '%joskds%')
    .single()
  
  if (!cliente) {
    console.log("No se encontró al cliente joskds");
    return;
  }

  console.log("Cliente encontrado:", cliente.id, cliente.usuario, "AuthID:", cliente.auth_user_id);

  // 2. Buscar su billetera
  const { data: wallet } = await supabase
    .from('billeteras')
    .select('*')
    .eq('auth_user_id', cliente.auth_user_id)
    .single()
  
  console.log("Billetera:", wallet);

  // 3. Buscar transacciones recientes
  const { data: trans } = await supabase
    .from('billetera_transacciones')
    .select('*')
    .eq('auth_user_id', cliente.auth_user_id)
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log("Últimas transacciones:", trans);

  // 4. Buscar pedidos recientes de este cliente
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, total_bs, estado, pago_verificado, created_at')
    .eq('cliente_id', cliente.auth_user_id)
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log("Últimos pedidos:", pedidos);
}

probe()
