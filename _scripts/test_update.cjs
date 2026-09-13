
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function check() {
  const { data: clients, error: err1 } = await supabase.from('clientes').select('auth_user_id').limit(1);
  if (!clients || clients.length === 0) return console.log('No clients');
  const uid = clients[0].auth_user_id;
  
  const { data, error } = await supabase.rpc('actualizar_perfil_usuario_rpc', {
    p_user_id: uid,
    p_juegos_favoritos: ['123', '456']
  });
  console.log('RPC result:', data, error);
  
  const { data: fetchResult } = await supabase.from('clientes').select('juegos_favoritos').eq('auth_user_id', uid).single();
  console.log('After update:', fetchResult);
}
check();

