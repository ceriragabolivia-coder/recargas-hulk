import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve('.env.vercel.prod')
const envContent = fs.readFileSync(envPath, 'utf-8')
let url = '', key = ''
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim()
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim()
})

const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      cliente_id,
      cliente:cliente_id ( id, nombres )
    `)
    .limit(1)

  console.log("Error 1:", error?.message)
  
  const { data: d2, error: e2 } = await supabase
    .from('pedidos')
    .select(`
      id,
      cliente_id,
      clientes ( id, nombres )
    `)
    .limit(1)

  console.log("Error 2:", e2?.message)
}

test()
