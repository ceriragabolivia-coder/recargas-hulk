
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
  const { data, error } = await supabase.rpc('admin_approve_user', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_status: 'test'
  });

  if (error) {
    console.log('Function check error:', error.message);
  } else {
    console.log('Function exists and returned:', data);
  }
}

checkFunction();
