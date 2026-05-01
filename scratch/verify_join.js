
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFKs() {
  const { data, error } = await supabase.rpc('get_table_info', { t_name: 'clientes' });
  if (error) {
     // If RPC doesn't exist, try a simple select from a non-existent table to see error messages or just guess.
     // Better yet, let's use a standard query if we had a more powerful tool, but we don't.
     // Let's try to query information_schema if possible? No, usually blocked.
     console.error('Error:', error);
  } else {
    console.log('Data:', data);
  }
}

// Since I can't easily query system tables, I'll try to verify the join with a different syntax.
async function verifyJoin() {
    // Try joining with explicit table name
    const { data, error } = await supabase
        .from('clientes')
        .select('nombres, auth_user_id, perfiles(rol)')
        .limit(1);
    
    console.log('Join perfiles(rol):', { data, error });
}

verifyJoin();
