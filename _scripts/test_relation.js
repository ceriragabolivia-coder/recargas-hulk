import { createClient } from '@supabase/supabase-js'

const url = 'https://atcaolkiooosmdiipnkq.supabase.co'
const key = 'sb_publishable_RvvCRLHf5NRqWZbyHHOKIA_X8V_90e8'

const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, ventas(ganancia_usd)')
    .limit(1)
    
  console.log('Error:', error)
  console.log('Data:', JSON.stringify(data, null, 2))
}
test()
