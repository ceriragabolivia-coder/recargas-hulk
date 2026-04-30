import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTriggers() {
  const { data, error } = await supabase.rpc('debug_list_triggers', { p_table: 'pedidos' })
  if (error) {
    // If RPC doesn't exist, try a direct query via SQL (if enabled) or just list all functions
    console.error('Error calling debug_list_triggers:', error)
    
    // Let's try to query information_schema if possible via a generic RPC
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { 
      p_sql: "SELECT trigger_name, event_manipulation, action_statement, action_timing FROM information_schema.triggers WHERE event_object_table = 'pedidos'"
    })
    
    if (error2) {
      console.error('Error calling exec_sql:', error2)
    } else {
      console.log('Triggers on pedidos:', data2)
    }
  } else {
    console.log('Triggers on pedidos:', data)
  }
}

checkTriggers()
