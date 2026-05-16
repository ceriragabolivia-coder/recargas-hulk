const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkTriggers() {
  // If exec_sql is missing, we try to use a different way or just assume we can't.
  // But wait, the previous model might have named it something else.
  // Let's try to find if there is an RPC that allows running SQL.
  
  const { data, error } = await supabase.rpc('send_telegram_message', { p_message: '🔍 Checking system...' });
  console.log('send_telegram_message check:', { data, error });

  // Let's try to find if there is a trigger by observing behavior or other hints.
}

checkTriggers();
