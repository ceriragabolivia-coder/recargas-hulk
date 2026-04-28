
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listFunctions() {
  // Querying pg_proc for functions containing 'aprobar' or 'approve'
  const { data, error } = await supabase.from('_dummy').select('*').limit(0); // Dummy to get client
  
  // Actually, I'll use a raw SQL query via a known RPC or just try to call it and see if I get a 403 or 404
  const { error: err1 } = await supabase.rpc('admin_approve_user', { p_user_id: '00000000-0000-0000-0000-000000000000', p_status: 'test' });
  const { error: err2 } = await supabase.rpc('rpc_aprobar_usuario', { p_user_id: '00000000-0000-0000-0000-000000000000', p_status: 'test' });

  console.log('admin_approve_user error:', err1?.message);
  console.log('rpc_aprobar_usuario error:', err2?.message);
}

listFunctions();
