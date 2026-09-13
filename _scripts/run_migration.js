const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('c:/hulk/app/supabase/migrations/149_add_perfiles_to_realtime.sql', 'utf8');
  console.log('Ejecutando script de migracion...');
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('Error (puede ser que la funcion exec_sql no exista, lo cual es normal en Supabase sin pg_graphql o funcion custom):', error);
  } else {
    console.log('Exito:', data);
  }
}
run();
