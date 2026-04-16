import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const lastUserIdRef = useRef(null)
  const isInitializedRef = useRef(false)

  // Carga de Perfil optimizada con modo VIP y Failsafe (Incluye Billetera)
  async function fetchPerfilData(userId, authUser = null) {
    if (!userId) return null
    
    // 1. MODO VIP: Acceso instantáneo para el administrador principal
    const u = authUser || (await supabase.auth.getUser()).data?.user
    if (u?.email === 'ceriraga@gmail.com') {
      console.log('👑 Auth: Modo VIP activado para admin primario');
      // Intentamos cargar billetera y cliente_uuid igual pero no bloqueamos
      supabase.from('billeteras').select('*').eq('auth_user_id', userId).maybeSingle().then(({data}) => {
        if (data) setPerfil(prev => ({ ...prev, ...data }));
      });
      supabase.from('clientes').select('id').eq('auth_user_id', userId).maybeSingle().then(({data}) => {
        if (data) setPerfil(prev => ({ ...prev, cliente_uuid: data.id }));
      });

      return { 
        id: userId, 
        rol: 'admin', 
        estado: 'aprobado', 
        nombres: 'Administrador',
        nickname: 'Admin',
        is_vip: true 
      }
    }

    try {
      // 2. Consulta paralela con Timeout de 2.5 segundos (Failsafe)
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 2500))
      
      const fetchPromise = (async () => {
        const [resP, resC, resB] = await Promise.all([
          supabase.from('perfiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle(),
          supabase.from('billeteras').select('*').eq('auth_user_id', userId).maybeSingle()
        ])
        
        const perfilData = resP.data
        let clienteData = resC.data
        const walletData = resB.data
        
        // Auto-creación de cliente si no existe
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

        return { 
          ...clienteData, 
          ...perfilData, 
          ...walletData, // Restauramos saldo, saldo_bs, etc.
          id: userId, 
          cliente_uuid: clienteData?.id || null,
          rol: (perfilData?.rol || clienteData?.rol || 'cliente').toLowerCase(),
          estado: (perfilData?.estado || clienteData?.estado || 'pendiente').toLowerCase(),
          is_vip: false
        }
      })()

      return await Promise.race([fetchPromise, timeoutPromise])
    } catch (err) {
      console.warn('⚠️ Auth: Usando perfil de emergencia debido a lentitud/error');
      return { id: userId, rol: 'cliente', estado: 'pendiente', is_fallback: true }
    }
  }

  useEffect(() => {
    let channel;

    const setupRealtime = (userId) => {
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel(`auth_perfil_${userId}`)
        .on('postgres_changes', { 
          event: 'UPDATE', schema: 'public', table: 'perfiles', filter: `id=eq.${userId}` 
        }, payload => setPerfil(prev => ({ ...prev, ...payload.new })))
        .subscribe()
    }

    const initializeAuth = async () => {
      if (isInitializedRef.current) return
      isInitializedRef.current = true

      try {
        const sessionPromise = supabase.auth.getSession()
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LOCK')), 3000))
        
        const { data: { session } } = await Promise.race([sessionPromise, timeout])
        const u = session?.user ?? null
        
        if (u) {
          lastUserIdRef.current = u.id
          setUser(u)
          const pData = await fetchPerfilData(u.id, u)
          setPerfil(pData)
          setupRealtime(u.id)
        }
      } catch (err) {
        console.error("❌ Auth: Error en inicialización inicial:", err)
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
      setLoading(true)
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
  if (!context) throw new Error('Auth context missing')
  return context
}
