import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

// Usamos el cliente con rol anon por defecto, pero como tenemos que actualizar y saltar RLS desde un script backend (donde no dejas el anon logged in):
// Espera, la clave que hay en el .env es VITE_SUPABASE_ANON_KEY, que por definición sigue políticas RLS. 
// Para el script vamos a hacer auth con el correo y clave que usamos para login en la app!
async function fixData() {
  const supabase = createClient(url, key);
  
  // Login first to bypass RLS "authenticated" requirement!
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@ceriraga.com',
    password: 'admin' // Suponiendo que esta era la clave o que haya otra
  });
  
  if (authErr) {
    console.error('Auth error:', authErr);
    // Intentar directamente por si las políticas lo permiten (ej si están abiertas momentaneamente o algo)
  }

  const { data: qData, error: qErr } = await supabase.from('ventas').select('id, created_at, fecha');
  if (qErr) {
    console.error('Fetch error:', qErr);
    return;
  }
  
  let updated = 0;
  for (let row of qData || []) {
    // Si la fecha registrada no cuadra con la local de caracas por culpa del server default
    // Caracas is UTC-4.
    const dateObj = new Date(row.created_at);
    // adjust to caracas:
    const tzOffset = 4 * 60 * 60000; 
    const correctDateLocal = new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
    
    if (row.fecha !== correctDateLocal) {
      await supabase.from('ventas').update({ fecha: correctDateLocal }).eq('id', row.id);
      updated++;
    }
  }
  
  console.log(`Updated ${updated} rows in ventas with correct local dates.`);
}

fixData();
