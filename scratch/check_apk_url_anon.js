import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkConfig() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .limit(10)

  if (error) {
    console.error('❌ Error fetching config:', error.message)
  } else {
    console.log('✅ Current config samples:', data)
  }
}

checkConfig()
