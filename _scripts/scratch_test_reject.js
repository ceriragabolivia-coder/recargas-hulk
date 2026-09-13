import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
// Need service role key to bypass RLS, or login as admin.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testReject() {
  // Find a pending recarga
  const { data: recarga } = await supabase
    .from('billetera_recargas')
    .select('id, auth_user_id, estado')
    .eq('estado', 'pendiente')
    .limit(1)
    .single();

  if (!recarga) {
    console.log('No pending recarga found');
    return;
  }
  
  console.log('Testing with recarga:', recarga.id);

  // Try to update it
  const { data, error } = await supabase
    .from('billetera_recargas')
    .update({ estado: 'rechazado', updated_at: new Date().toISOString() })
    .eq('id', recarga.id);

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Update succeeded:', data);
  }
}

testReject();
