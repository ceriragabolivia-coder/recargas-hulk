
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data, error } = await supabase.from('configuracion').select('*')
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Data:', JSON.stringify(data, null, 2))
  }
}

test()
