const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const res = await fetch(`${supabaseUrl}/rest/v1/clientes?limit=1`, { headers: { 'apikey': supabaseAnonKey } });
  const data = await res.json();
  console.log("Clientes:", data.length ? Object.keys(data[0]) : "No data");
  
  const res2 = await fetch(`${supabaseUrl}/rest/v1/perfiles?limit=1`, { headers: { 'apikey': supabaseAnonKey } });
  const data2 = await res2.json();
  console.log("Perfiles:", data2.length ? Object.keys(data2[0]) : "No data");
}
test();
