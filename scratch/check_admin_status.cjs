
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
  // We can't easily simulate auth.uid() in a script without a token
  // but we can query the table directly if we have service role, 
  // but here we use anon key.
  
  // Let's try to call the is_admin function via RPC if it's exposed
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
  console.log('is_admin() result (anon context):', isAdmin);
  if (rpcError) console.error('RPC Error:', rpcError);

  // Let's check the perfiles table for ceriraga
  const { data: profiles, error: pError } = await supabase
    .from('perfiles')
    .select('*')
    .ilike('rol', 'admin');
  
  console.log('Admin profiles found:', profiles?.length);
  if (profiles) {
    profiles.forEach(p => console.log(`ID: ${p.id}, Rol: ${p.rol}, Estado: ${p.estado}`));
  }
}

checkAdmin();
