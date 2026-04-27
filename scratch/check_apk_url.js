import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY are required environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkConfig() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('clave', 'apk_url')
    .single()

  if (error) {
    console.error('❌ Error fetching config:', error.message)
  } else {
    console.log('✅ Current config:', data)
  }
}

checkConfig()
