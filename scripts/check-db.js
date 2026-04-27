import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function checkSchema() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Columnas detectadas:', Object.keys(data[0] || {}))
  }
}

checkSchema()
