const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ'
const supabase = createClient(supabaseUrl, supabaseKey)

async function probe() {
  const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'billeteras' })
  if (cols) console.log("Columns of billeteras:", cols)
  
  // Si no existe el RPC, intentamos con una consulta
  const { data: sample } = await supabase.from('billeteras').select('*').limit(1)
  if (sample && sample.length > 0) {
    console.log("Sample record from billeteras:", Object.keys(sample[0]))
  }
}
probe()
