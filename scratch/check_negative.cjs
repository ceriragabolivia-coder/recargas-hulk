const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=\"?(.*?)\"?$/m)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"?(.*?)\"?$/m)[1];
const supabase = createClient(url, key);

async function checkNegatives() {
  const { data: profiles, error } = await supabase.from('perfiles').select('id, nombre, email, saldo').lt('saldo', 0);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Usuarios con saldo negativo:');
    console.table(profiles);
  }
}
checkNegatives();
