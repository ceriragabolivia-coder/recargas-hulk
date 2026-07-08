import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);"
  });
  
  if (error && error.message.includes('execute_sql')) {
     console.log('No execute_sql RPC, creating one...');
  } else {
     console.log('Result:', data || error);
  }
}
check();
