import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  console.log('🔑 AuthContext: Inicializando AuthProvider...');
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const lastUserIdRef = useRef(null)
  const isInitializedRef = useRef(false)

  async function fetchPerfilData(userId, existingUser = null) {
    if (!userId) return null
    try {
      const authUser = existingUser || (await supabase.auth.getUser()).data?.user
      const { data: perfilData, error: errorP } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle()
      let { data: clienteData, error: errorC } = await supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle()
      
      if (errorP || errorC) {
        console.warn("Advertencia al cargar perfil/cliente:", errorP || errorC)
      }

      if (!clienteData && authUser) {
        const u = authUser
        const { data: nuevoCliente } = await supabase.from('clientes').insert({
          auth_user_id: userId,
          nombres: u.user_metadata?.nombres || u.email?.split('@')[0] || 'Admin',
          apellidos: u.user_metadata?.apellidos || '',
          usuario: u.email || userId,
          nickname: u.user_metadata?.nickname || 'Admin',
          whatsapp: u.user_metadata?.whatsapp || '',
          estado: 'aprobado'
        }).select().maybeSingle()
        clienteData = nuevoCliente
      }
      
      if (authUser?.email === 'ceriraga@gmail.com') {
        const adminPerfil = { 
          ...clienteData,
          id: userId,
          cliente_uuid: clienteData?.id,
          rol: 'admin', 
          role: 'admin', 
          estado: 'aprobado'
        }
        if (clienteData?.id) {
           supabase.from('clientes').update({ ultima_conexion: new Date().toISOString() }).eq('id', clienteData.id).then()
        }
        return adminPerfil
      }

      const finalRol = (perfilData?.rol || clienteData?.rol || 'cliente').toLowerCase()
      const finalEstado = (perfilData?.estado || clienteData?.estado || 'pendiente').toLowerCase()

      const fullPerfil = { 
        ...clienteData, 
        ...perfilData, 
        id: userId, 
        cliente_uuid: clienteData?.id || null,
        rol: finalRol,
        estado: finalEstado
      }

      if (clienteData?.id) {
         supabase.from('clientes').update({ ultima_conexion: new Date().toISOString() }).eq('id', clienteData.id).then()
      }
      return fullPerfil
    } catch (err) {
      console.error("Error crítico en fetchPerfilData:", err)
      return { id: userId, rol: 'cliente', estado: 'pendiente', error: true }
    }
  }

  const fetchPerfil = async (userId, existingUser = null) => {
    const data = await fetchPerfilData(userId, existingUser)
    if (data) setPerfil(data)
  }

  useEffect(() => {
    let channel;

    const setupRealtime = (userId) => {
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel(`perfil_realtime_${userId}`)
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
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        const u = session?.user ?? null
        if (u) {
          lastUserIdRef.current = u.id
          const pData = await fetchPerfilData(u.id, u)
          setPerfil(pData)
          setUser(u)
          setupRealtime(u.id)
        }
      } catch (err) {
        console.error("Error crítico inicializando auth:", err)
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
        return
      }

      if (u && u.id !== lastUserIdRef.current) {
        lastUserIdRef.current = u.id
        const pData = await fetchPerfilData(u.id, u)
        setPerfil(pData)
        setUser(u)
        setupRealtime(u.id)
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
  
  const isCliente = useMemo(() => !isAdminOrRevendedor, [isAdminOrRevendedor])

  const value = useMemo(() => ({
    user,
    perfil,
    loading,
    isCliente,
    isAdminOrRevendedor,
    login: async (email, password) => await supabase.auth.signInWithPassword({ email, password }),
    register: async (email, password, clientDetails) => {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: clientDetails }
      })
      if (data?.user) {
        const checkProfile = await supabase.from('perfiles').select('id').eq('id', data.user.id).maybeSingle()
        if (!checkProfile.data) {
          await supabase.from('perfiles').insert({ id: data.user.id, rol: 'cliente', estado: 'pendiente' })
          await supabase.from('clientes').insert({
            auth_user_id: data.user.id,
            nombres: clientDetails.nombres,
            apellidos: clientDetails.apellidos,
            nickname: clientDetails.nickname,
            usuario: email,
            whatsapp: clientDetails.whatsapp,
            pais: clientDetails.pais,
            estado: 'pendiente'
          })
        }
      }
      return { data, error }
    },
    logout: async () => {
      await supabase.auth.signOut()
      setPerfil(null)
      setUser(null)
      lastUserIdRef.current = null
    },
    updatePassword: async (newPassword) => await supabase.auth.updateUser({ password: newPassword }),
    refetch: () => user && fetchPerfil(user.id)
  }), [user, perfil, loading, isCliente, isAdminOrRevendedor])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
