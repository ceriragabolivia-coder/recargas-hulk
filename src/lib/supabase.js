import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRÍTICO: Variables de entorno de Supabase no encontradas.')
}

// Configuración normalizada para evitar bloqueos de pestañas (Supabase Lock)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Eliminamos storageKey personalizada para evitar conflictos de Lock entre pestañas
    // Supabase usará el valor por defecto 'supabase.auth.token'
  }
})

console.log('✅ Supabase: Cliente inicializado (Modo Normalizado)')
