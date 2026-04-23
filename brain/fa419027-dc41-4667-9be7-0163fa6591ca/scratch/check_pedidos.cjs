const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id')
    .limit(1)
  
  if (error) {
    console.log('Error fetching pedidos: ', error.message)
  } else {
    console.log('Pedidos count:', data.length)
  }
}

debug()
