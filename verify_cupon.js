import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function test() {
  // First find the user
  const { data: users, error: errU } = await supabase.from('perfiles').select('id').limit(1);
  if (errU || !users || users.length === 0) {
    console.error("No users found");
    return;
  }
  const userId = users[0].id;
  
  // Find a valid cupon
  const { data: cupones, error: errC } = await supabase.from('cupones').select('*').eq('activo', true).limit(1);
  if (errC || !cupones || cupones.length === 0) {
    console.error("No active cupones found");
    return;
  }
  const cupon = cupones[0];

  console.log(`Validating cupon ${cupon.codigo} for user ${userId}`);
  
  const { data: res, error: err } = await supabase.rpc('validar_cupon_rpc', {
    p_codigo: cupon.codigo,
    p_usuario_id: userId
  });
  
  console.log("RPC Data:", res);
  console.log("RPC Error:", err);
  
  // Verify if it was inserted
  const { data: check } = await supabase.from('cupones_usuarios').select('*').eq('usuario_id', userId).eq('cupon_id', cupon.id);
  console.log("Cupones_usuarios row:", check);
}

test();
