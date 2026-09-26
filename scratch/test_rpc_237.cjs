const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('rechazar_pagos_apk_expirados_rpc');
  console.log('RPC Response:', data, error);
}
run();
