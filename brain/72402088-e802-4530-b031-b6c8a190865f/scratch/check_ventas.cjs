const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAdminProfile() {
  console.log(`🔍 Checking perfiles for admin...`);
  
  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select('*')
    .limit(10); // Check first 10 perfiles

  if (error) {
    console.error("❌ Error fetching perfiles:", error);
    return;
  }

  console.log(`👤 Found ${perfiles.length} perfiles.`);
  perfiles.forEach((p, i) => {
    console.log(`${i}: ID: ${p.id} | Rol: ${p.rol} | Email (if exists): ${p.email || 'N/A'}`);
  });
}

checkAdminProfile();
