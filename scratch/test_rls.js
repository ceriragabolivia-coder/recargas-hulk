import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  // Try to login with ceriraga@gmail.com to see what roles they have
  // Wait, I can't login without password. 
  // Let's just check the RLS policy of producto_codigos by writing a custom SQL query via RPC if possible.
  // Actually, I can just use a scratch script to check the policies from pg_policies.
}

test()
