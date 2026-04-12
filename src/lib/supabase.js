import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'ceriraga-app-v2-prod', // Llave única para evitar conflictos entre dominios y pestañas
    flowType: 'pkce' // Flow recomendado para evitar problemas de locks en algunos entornos
  }
})
