
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    // Check if we can call is_admin
    const { data: isAdmin, error: err1 } = await supabase.rpc('is_admin');
    console.log('is_admin() as ANON:', isAdmin, err1);

    // Check if we can call is_superadmin
    const { data: isSA, error: err2 } = await supabase.rpc('is_superadmin');
    console.log('is_superadmin() as ANON:', isSA, err2);
    
    // List policies if possible (usually not)
}

probe();
