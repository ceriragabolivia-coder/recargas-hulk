import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vsmpxvzmferpqpfaulgb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ'
);

async function main() {
  const url = '/bg-global.jpg';
  const { data, error } = await supabase
    .from('configuracion')
    .upsert(
      { clave: 'fondo_global_url', valor_texto: url, owner_id: null },
      { onConflict: 'clave,owner_id' }
    );
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Updated config to', url);
  }
}
main();
