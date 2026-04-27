import { createClient } from '@supabase/supabase-js'
// v1.0.1 - Triggering build

import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY are required environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function uploadAPK() {
  const apkPath = path.resolve('android/app/build/outputs/apk/release/app-release-unsigned.apk')
  
  if (!fs.existsSync(apkPath)) {
    console.error(`❌ Error: APK not found at ${apkPath}`)
    process.exit(1)
  }

  const fileBuffer = fs.readFileSync(apkPath)
  const fileName = 'apps/latest-release.apk'

  console.log(`📤 Uploading APK to Supabase Storage: ${fileName}...`)

  const { data, error } = await supabase.storage
    .from('logos')
    .upload(fileName, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true
    })

  if (error) {
    console.error('❌ Error uploading APK:', error.message)
    process.exit(1)
  }

  console.log('✅ APK uploaded successfully to storage.')

  // 2. Obtener la URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('logos')
    .getPublicUrl(fileName)

  console.log(`🔗 Public URL: ${publicUrl}`)

  // 3. Llamar a la función especial que creamos en Supabase
  console.log('🔄 Calling secure RPC to update APK URL...')
  const { error: rpcError } = await supabase
    .rpc('actualizar_apk_url', { nueva_url: publicUrl })

  if (rpcError) {
    console.error('❌ Error calling RPC:', rpcError.message)
    process.exit(1)
  }

  console.log('🚀 SUCCESS! The download button is now updated using the secure RPC.')
}

uploadAPK()
