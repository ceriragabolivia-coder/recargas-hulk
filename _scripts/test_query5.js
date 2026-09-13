import { createClient } from '@supabase/supabase-js'

const url = 'https://atcaolkiooosmdiipnkq.supabase.co'
const key = 'sb_publishable_RvvCRLHf5NRqWZbyHHOKIA_X8V_90e8'

const supabase = createClient(url, key)

async function test() {
  const ids = ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000']
  const inString = `(${ids.join(',')})`
  console.log('inString:', inString)
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .or(`id.in.${inString},auth_user_id.in.${inString}`)
    
  console.log('Error:', error)
  console.log('Data:', data)
}
test()
