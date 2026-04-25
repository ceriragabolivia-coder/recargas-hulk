const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  const { data: countData, error: countError } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
  
  if (countError) {
    console.log('Error counting pedidos: ', countError.message)
  } else {
    console.log('Total Pedidos:', countData?.length || 0)
  }

  const { data: salesData, error: salesError } = await supabase
    .from('ventas')
    .select('pedido_id')
    .limit(1)
  
  if (salesError) {
    console.log('Error fetching ventas: ', salesError.message)
  } else {
    console.log('Sample Venta Pedido ID:', salesData[0]?.pedido_id)
    console.log('Type of Venta Pedido ID:', typeof salesData[0]?.pedido_id)
  }
}

debug()
