
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkColumnType() {
  const { data, error } = await supabase.rpc('get_column_type', { p_table: 'pedidos', p_column: 'created_at' })
  if (error) {
    // If RPC doesn't exist, try raw query via another RPC or just assume
    console.error(error)
  } else {
    console.log('Column type:', data)
  }
}

checkColumnType()
