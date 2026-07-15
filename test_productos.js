import { createClient } from '@supabase/supabase-js'

const url = 'https://atcaolkiooosmdiipnkq.supabase.co'
const key = 'sb_publishable_RvvCRLHf5NRqWZbyHHOKIA_X8V_90e8'
const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, costo_base, margen_ganancia, precio_venta_fijo')
    .ilike('nombre', '%220%Diamantes%')
    
  console.log('Error:', error)
  console.log('Productos:', JSON.stringify(data, null, 2))
}
test()
