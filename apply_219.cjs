const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const sql = fs.readFileSync('supabase/migrations/219_add_api_provider_productos.sql', 'utf8');
    console.log("Running SQL Migration...");
    const { data, error } = await supabase.rpc('exec_sql', { p_sql: sql });
    if (error) {
      console.error("❌ SQL Error:", error);
    } else {
      console.log("✅ SQL Migration applied successfully!");
      console.log(data);
    }
  } catch (err) {
    console.error(err);
  }
}

runMigration();
