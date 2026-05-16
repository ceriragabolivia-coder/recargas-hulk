const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Leer .env manualmente
const envPath = path.join(__dirname, '..', '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) env[key.trim()] = value.trim()
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const settings = [
  { clave: 'telegram_bot_token', valor: 0, valor_texto: '7950382410:AAEJj-t-s8mPfYd6zMRz823IYBGZ0B1xjcU', owner_id: null },
  { clave: 'telegram_chat_id', valor: 0, valor_texto: '-1003732979887', owner_id: null },
  { clave: 'telegram_notifications_enabled', valor: 1, valor_texto: 'true', owner_id: null }
]

async function setup() {
  console.log('--- Configurando credenciales de Telegram ---')
  for (const s of settings) {
    const { error } = await supabase
      .from('configuracion')
      .upsert(s, { onConflict: 'clave,owner_id' })
    
    if (error) {
      console.error(`❌ Error al guardar ${s.clave}:`, error.message)
    } else {
      console.log(`✅ Guardado: ${s.clave}`)
    }
  }
}

setup()
