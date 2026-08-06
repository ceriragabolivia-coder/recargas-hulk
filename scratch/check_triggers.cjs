const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const query = `
    SELECT tgname, relname, pg_get_triggerdef(pg_trigger.oid)
    FROM pg_trigger
    JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
    WHERE relname IN ('pines', 'billetera_transacciones') AND NOT tgisinternal;
  `;
  const { data, error } = await supabase.rpc('execute_sql', { sql: query });
  
  if (error) {
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { p_sql: query });
    if (e2) {
      console.error(e2);
    } else {
      console.log(d2);
    }
  } else {
    console.log(data);
  }
}

run();
