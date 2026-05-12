
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMessages() {
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, usuario, nombres, apellidos')
    .limit(10)

  console.log('Clientes:', clientes)
}

checkMessages()
