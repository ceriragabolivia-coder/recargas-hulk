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
  const releasePath = path.resolve('android/app/build/outputs/apk/release/app-release.apk')
  const debugPath = path.resolve('android/app/build/outputs/apk/debug/app-debug.apk')
  
  let apkPath = releasePath
  
  if (!fs.existsSync(apkPath)) {
    console.log('ℹ️ Release APK not found, checking for Debug APK...')
    apkPath = debugPath
  }

  if (!fs.existsSync(apkPath)) {
    console.error(`❌ Error: No APK found at ${releasePath} or ${debugPath}`)
    console.log('💡 Tip: Run "./gradlew assembleDebug" in the android folder first.')
    process.exit(1)
  }

  console.log(`✅ Using APK: ${apkPath}`)

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

  // 3. Intento final: Usamos la columna 'valor_texto' que es la correcta para URLs
  console.log('🔄 Updating valor_texto column...')
  const { error: finalError } = await supabase
    .from('configuracion')
    .update({ valor_texto: publicUrl })
    .match({ clave: 'apk_url' })

  if (finalError) {
    console.error('❌ Update failed:', finalError.message)
    process.exit(1)
  }

  console.log('🚀 SUCCESS! The APK URL is now saved in the correct text column.')
}

uploadAPK()
