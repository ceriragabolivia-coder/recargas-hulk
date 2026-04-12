import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const lastUserIdRef = useRef(null)
  const isInitializedRef = useRef(false)

  // Carga de Perfil con Mecanismo de Carril Rápido
  async function fetchPerfilData(userId, authUser = null) {
    if (!userId) return null
    
    // Timeout de seguridad interno para la consulta a la base de datos (3s)
    const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 3500))

    try {
      const fetchPromise = (async () => {
        const [resP, resC] = await Promise.all([
          supabase.from('perfiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle()
        ])

        const perfilData = resP.data
        let clienteData = resC.data
        const u = authUser || (await supabase.auth.getUser()).data?.user

        // Crear registro si no existe
        if (!clienteData && u) {
          const { data: nuevoCliente } = await supabase.from('clientes').insert({
            auth_user_id: userId,
            nombres: u.user_metadata?.nombres || u.email?.split('@')[0] || 'Usuario',
            apellidos: u.user_metadata?.apellidos || '',
            usuario: u.email || userId,
            nickname: u.user_metadata?.nickname || 'Usuario',
            whatsapp: u.user_metadata?.whatsapp || '',
            estado: 'aprobado'
          }).select().maybeSingle()
          clienteData = nuevoCliente
        }

        const isAdminEmail = u?.email === 'ceriraga@gmail.com'
        
        return { 
          ...clienteData, 
          ...perfilData, 
          id: userId, 
          cliente_uuid: clienteData?.id || null,
          rol: isAdminEmail ? 'admin' : (perfilData?.rol || clienteData?.rol || 'cliente').toLowerCase(),
          estado: isAdminEmail ? 'aprobado' : (perfilData?.estado || clienteData?.estado || 'pendiente').toLowerCase(),
          is_fallback: false
        }
      })()

      // Competencia entre la base de datos y un perfil de emergencia
      return await Promise.race([fetchPromise, dbTimeout])

    } catch (err) {
      console.warn("⚠️ Usando perfil de emergencia:", err.message)
      // Perfil de emergencia mínimo para no bloquear la app
      return { 
        id: userId, 
        rol: 'cliente', 
        estado: 'pendiente', 
        email: authUser?.email,
        is_fallback: true 
      }
    }
  }

  useEffect(() => {
    let channel;

    const setupRealtime = (userId) => {
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel(`perfil_sync_${userId}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'perfiles', 
          filter: `id=eq.${userId}` 
        }, (payload) => {
          setPerfil(prev => ({ ...prev, ...payload.new }))
        })
        .subscribe()
    }

    const initializeAuth = async () => {
      if (isInitializedRef.current) return
      isInitializedRef.current = true

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const u = session?.user ?? null
        
        if (u) {
          lastUserIdRef.current = u.id
          setUser(u)
          const pData = await fetchPerfilData(u.id, u)
          setPerfil(pData)
          setupRealtime(u.id)
        }
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') return
      
      const u = session?.user ?? null
      
      if (event === 'SIGNED_OUT') {
        lastUserIdRef.current = null
        setUser(null)
        setPerfil(null)
        if (channel) supabase.removeChannel(channel)
        setLoading(false)
        return
      }

      if (u && u.id !== lastUserIdRef.current) {
        lastUserIdRef.current = u.id
        setUser(u)
        setLoading(true) 
        const pData = await fetchPerfilData(u.id, u)
        setPerfil(pData)
        setupRealtime(u.id)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const isAdminOrRevendedor = useMemo(() => 
    ['admin', 'revendedor'].includes(perfil?.rol?.toLowerCase()), 
    [perfil?.rol]
  )

  const value = useMemo(() => ({
    user, perfil, loading, 
    isCliente: !isAdminOrRevendedor,
    isAdminOrRevendedor,
    login: async (email, password) => {
      setLoading(true) // Iniciar carga visual durante el login manual
      const res = await supabase.auth.signInWithPassword({ email, password })
      if (res.error) setLoading(false)
      return res
    },
    logout: async () => {
      setLoading(true)
      await supabase.auth.signOut()
      setPerfil(null)
      setUser(null)
      lastUserIdRef.current = null
      setLoading(false)
    },
    refetch: async () => {
       if (user) {
         const pData = await fetchPerfilData(user.id, user)
         setPerfil(pData)
       }
    }
  }), [user, perfil, loading, isAdminOrRevendedor])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider missing')
  return context
}
