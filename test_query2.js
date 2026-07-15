import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve('.env.vercel')
const envContent = fs.readFileSync(envPath, 'utf-8')
let url = '', key = ''
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim()
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim()
})

const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase.from('pedidos').select('*').limit(5)
  console.log('Error:', error)
  console.log('Data:', data)
}
test()
