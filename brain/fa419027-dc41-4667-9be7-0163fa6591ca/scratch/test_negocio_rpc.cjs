const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const { data: perfil, error: err1 } = await supabase
    .from('perfiles')
    .select('id, nickname')
    .eq('rol', 'negocio')
    .limit(1);

  if (err1 || !perfil || perfil.length === 0) {
    console.log('Error fetching perfil:', err1);
    return;
  }
  
  const negocioId = perfil[0].id;
  console.log('Found Negocio ID:', negocioId);

  const { data, error } = await supabase.rpc('update_config_rpc', {
    p_clave: 'bg_floating_enabled',
    p_valor: 0,
    p_valor_texto: 'false',
    p_owner_id: negocioId
  });
  console.log('RPC update_config_rpc Result:', data, error);

  // Check config map for this user
  const { data: allConfigs, error: err2 } = await supabase.from('configuracion').select('clave, valor, valor_texto, owner_id');
  const userConfigs = allConfigs.filter(c => c.owner_id === negocioId);
  console.log('User Configs for bg_floating_enabled:', userConfigs.filter(c => c.clave === 'bg_floating_enabled'));
}

testRpc();
