const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const query = `
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS juego_nombre TEXT;
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS producto_nombre TEXT;
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS precio_usd NUMERIC;
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS precio_bs NUMERIC;
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS metodo_recarga VARCHAR(50);
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS nickname TEXT;
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS account_user TEXT;
    ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS producto_icono TEXT;
  `;
  const { data, error } = await supabase.rpc('execute_sql', { sql: query });
  console.log('Update:', data, error);
}
test();
