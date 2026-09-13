const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const query = fs.readFileSync('create_pines_schema.sql', 'utf8');

  // Utilizar execute_sql si existe, o probaremos un query alternativo
  console.log('Ejecutando creacion de tabla y funcion...');
  const { data, error } = await supabase.rpc('execute_sql', { sql: query });
  
  if (error) {
    console.error('Error al ejecutar execute_sql:', error);
    // Intentar con exec_sql en su lugar
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { p_sql: query });
    if(e2) {
      console.error('Error con exec_sql:', e2);
    } else {
      console.log('Exito con exec_sql', d2);
    }
  } else {
    console.log('Exito con execute_sql', data);
  }
}

run();
