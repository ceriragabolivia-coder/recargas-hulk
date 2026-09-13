const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Using the same URL and key from apply_migration.cjs
const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  try {
    const sql = fs.readFileSync('./supabase/migrations/152_pagos_apk.sql', 'utf8');
    console.log("Running SQL Migration...");
    const { data, error } = await supabase.rpc('exec_sql', { p_sql: sql });
    if (error) {
      console.error("❌ SQL Error:");
      console.error(error.message);
    } else {
      console.log("✅ SQL Migration applied successfully!");
      console.log(data);
    }
  } catch (err) {
    console.error(err);
  }
}

runMigration();
