const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const { data, error } = await supabase.rpc('update_config_rpc', {
    p_clave: 'test_rpc_num',
    p_valor: 123,
    p_valor_texto: null,
    p_owner_id: null
  });
  console.log('RPC Test Result (Numeric):', data, error);
}

testRpc();
