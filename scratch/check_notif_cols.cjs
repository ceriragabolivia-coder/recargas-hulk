const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function probeColumns() {
  const cols = ['id', 'user_id', 'titulo', 'mensaje', 'tipo', 'metadata'];
  for (const col of cols) {
    const { error } = await supabase.from('notificaciones_usuarios').select(col).limit(1);
    if (error) {
      console.log(`Column ${col}: MISSING (${error.message})`);
    } else {
      console.log(`Column ${col}: EXISTS`);
    }
  }
}

probeColumns();
