
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
    // We can't select from perfiles as ANON if RLS is on and we are not sa.
    // But we can try to see if ANY profile is visible.
    const { data, error } = await supabase.from('perfiles').select('rol').limit(10);
    console.log('Roles visible to ANON:', data, error);
}

checkRoles();
