
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('*');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log('Total profiles:', profiles.length);
  profiles.forEach(p => {
    if (p.rol && p.rol.toLowerCase().includes('admin')) {
      console.log(`ADMIN FOUND -> ID: ${p.id}, Rol: ${p.rol}, Estado: ${p.estado}`);
    }
  });
}

checkAdmin();
