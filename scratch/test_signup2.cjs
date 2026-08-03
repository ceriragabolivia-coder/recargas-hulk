const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://api.recargashulk.com'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDY4MjE1LCJleHAiOjIxMDA4MjY3OTl9.GjBpb6QuAq07NqUfUL5f8Qcm91yvA3ZMDHUoVPEcrmA'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSignup() {
  console.log('Testing signup...')
  const { data, error } = await supabase.auth.signUp({
    email: 'test_123_456@gmail.com',
    password: 'password123',
    options: {
      data: {
        nombres: 'Test',
        apellidos: 'User',
        whatsapp: '+584120000000',
        pais: 'Venezuela'
      }
    }
  })
  console.log('DATA:', JSON.stringify(data, null, 2))
  console.log('ERROR:', error)
}

testSignup()
