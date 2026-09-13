import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function test() {
  // 1. Insert a dummy pending recarga
  let { data: recarga, error: e1 } = await supabase
    .from('billetera_recargas')
    .insert({
      auth_user_id: '6c1a8a25-c64a-4710-9cf6-9ed22db2a5f2', // some random UUID or keep null if not enforced
      monto: 15.0,
      referencia_pago: 'TEST12345',
      estado: 'pendiente'
    })
    .select()
    .single();

  if (e1) {
    console.log("Error inserting mock recarga:", e1);
    // Let's try to get an existing user id if foreign key fails
    const { data: u } = await supabase.from('clientes').select('auth_user_id').limit(1).single();
    if(u) {
       const { data: recarga2, error: e1b } = await supabase.from('billetera_recargas').insert({
         auth_user_id: u.auth_user_id,
         monto: 15.0,
         referencia_pago: 'TEST12345',
         estado: 'pendiente'
       }).select().single();
       if(e1b) return console.log(e1b);
       recarga = recarga2;
    } else return;
  }

  console.log("Testing with recarga:", recarga.id, "Ref:", recarga.referencia_pago, "Monto:", recarga.monto);

  // 2. Insert mock pago apk for it
  const { data: apk, error: e2 } = await supabase
    .from('pagos_apk')
    .insert({
      referencia: recarga.referencia_pago,
      monto: recarga.monto,
      status: 'disponible',
      fecha_pago: new Date().toISOString()
    }).select().single();

  if (e2) {
    console.log("Error inserting apk:", e2);
  } else {
    console.log("Inserted mock apk:", apk.id);
  }

  // 3. Call RPC
  const { data: result, error: e3 } = await supabase.rpc('intentar_auto_aprobar_recarga_rpc', {
    p_recarga_id: recarga.id,
    p_referencia: recarga.referencia_pago,
    p_monto: recarga.monto,
    p_usuario_id: recarga.auth_user_id
  });

  console.log("RPC Result:", result, "Error:", e3);
}

test();
