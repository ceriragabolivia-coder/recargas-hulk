import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.vercel' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      total_usd,
      total_bs,
      created_at,
      cliente_id,
      clientes (
        id,
        nombres,
        telefono,
        email,
        perfiles (rol)
      )
    `)
    .eq('estado', 'completado')
    .limit(1)

  if (error) console.error("Error:", error.message)
  else console.log("Data:", JSON.stringify(data, null, 2))
}

test()
