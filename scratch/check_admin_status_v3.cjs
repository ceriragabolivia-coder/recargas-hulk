
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
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
