import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConfig() {
  const { data, error } = await supabase.from('configuracion').select('*')
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
}

checkConfig()
