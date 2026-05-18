const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sql = fs.readFileSync('c:/desarrollo/excel/app/supabase/migrations/123_fix_producto_codigos_rls.sql', 'utf8');
  console.log('Running migration...');
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error running migration:', error.message);
  } else {
    console.log('Migration executed successfully!');
  }
}

runMigration();
