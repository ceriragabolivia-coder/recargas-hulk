const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  const { data: messages, error: mErr } = await supabase
    .from('soporte_mensajes')
    .select('id, cliente_id')
    .limit(100)
  
  console.log('Total messages found:', messages?.length)
  if (mErr) console.error('M error:', mErr)

  if (messages && messages.length > 0) {
    const ids = [...new Set(messages.map(m => m.cliente_id).filter(id => id !== null))]
    console.log('Unique Client IDs in messages:', ids)
    
    const { data: clients, error: cErr } = await supabase
      .from('clientes')
      .select('id, nombres')
      .in('id', ids)
    
    console.log('Clients found in DB:', clients?.length)
    console.log('First few clients:', clients?.slice(0, 3))
    if (cErr) console.error('C error:', cErr)
  }
}

debug()
