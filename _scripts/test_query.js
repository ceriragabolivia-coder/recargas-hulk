import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve('.env.vercel')
const envContent = fs.readFileSync(envPath, 'utf-8')
let url = '', key = ''
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/"/g, '')
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/"/g, '')
})

const supabase = createClient(url, key)

async function test() {
  const start = new Date('2020-01-01')
  const end = new Date('2030-12-31')
  end.setHours(23, 59, 59, 999)

  const { data: pedidosData, error: dbError } = await supabase
    .from('pedidos')
    .select('estado')
    .limit(100)
    
  if (dbError) {
    console.error("Error fetching pedidos:", dbError)
    return
  }
  
  console.log("Estados:", [...new Set(pedidosData.map(p => p.estado))])
}

test()
