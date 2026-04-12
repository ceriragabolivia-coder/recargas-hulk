import { createClient } from '@supabase/supabase-js'

console.log('📡 Supabase: Inicializando cliente...');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase: Faltan variables de entorno (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'ceriraga-app-v3-prod',
    flowType: 'pkce'
  }
})
