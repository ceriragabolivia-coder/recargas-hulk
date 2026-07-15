import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://example.supabase.co', 'fake-key')

const query = supabase
  .from('clientes')
  .select('id')
  .or(`id.in.(123e4567-e89b-12d3-a456-426614174000),auth_user_id.in.(123e4567-e89b-12d3-a456-426614174000)`)

console.log(query.url.toString())
