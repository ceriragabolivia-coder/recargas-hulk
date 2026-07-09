import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function test() {
  const testEmail = `test_${Date.now()}@test.com`;
  const password = "password123";
  
  console.log("Signing up test user:", testEmail);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: testEmail,
    password: password
  });

  if (authErr) {
    console.error("Signup error:", authErr);
    return;
  }

  const userId = authData.user.id;
  console.log("Test user created with ID:", userId);

  // Call the RPC
  const couponCode = "MUSCULO";
  console.log(`Calling validar_cupon_rpc with ${couponCode} for user ${userId}`);
  
  const { data: rpcData, error: rpcErr } = await supabase.rpc('validar_cupon_rpc', {
    p_codigo: couponCode,
    p_usuario_id: userId
  });

  console.log("RPC Data:", rpcData);
  if (rpcErr) console.error("RPC Error:", rpcErr);

  // Fetch cupones_usuarios
  console.log("Fetching cupones_usuarios...");
  const { data: cuponesData, error: fetchErr } = await supabase
    .from('cupones_usuarios')
    .select('usos, cupon_id, usuario_id, cupones(*)')
    .eq('usuario_id', userId);

  console.log("Cupones usuarios fetched:", cuponesData);
  if (fetchErr) console.error("Fetch error:", fetchErr);
}

test();
