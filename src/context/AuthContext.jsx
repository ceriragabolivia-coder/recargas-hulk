import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const lastUserIdRef = useRef(null)
  const isInitializedRef = useRef(false)

  // Carga paralela de datos de perfil y cliente
  async function fetchPerfilData(userId, authUser = null) {
    if (!userId) return null
    try {
      // Paralelismo total: No esperar una para lanzar la otra
      const queries = [
        supabase.from('perfiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle()
      ]
      
      const [resP, resC] = await Promise.all(queries)
      const perfilData = resP.data
      let clienteData = resC.data
      
      // Obtener el usuario de auth solo si no lo tenemos
      const u = authUser || (await supabase.auth.getUser()).data?.user

      // Auto-registro para nuevos clientes que entran por primera vez
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
      
      // Lógica de Admin Prioritario
      if (u?.email === 'ceriraga@gmail.com') {
        const adminData = { 
          ...clienteData,
          id: userId,
          cliente_uuid: clienteData?.id,
          rol: 'admin', 
          estado: 'aprobado'
        }
        if (clienteData?.id) supabase.from('clientes').update({ ultima_conexion: new Date().toISOString() }).eq('id', clienteData.id).then()
        return adminData
      }

      // Perfil final consolidado
      const fullPerfil = { 
        ...clienteData, 
        ...perfilData, 
        id: userId, 
        cliente_uuid: clienteData?.id || null,
        rol: (perfilData?.rol || clienteData?.rol || 'cliente').toLowerCase(),
        estado: (perfilData?.estado || clienteData?.estado || 'pendiente').toLowerCase()
      }

      if (clienteData?.id) {
         supabase.from('clientes').update({ ultima_conexion: new Date().toISOString() }).eq('id', clienteData.id).then()
      }
      
      return fullPerfil
    } catch (err) {
      console.error("Error al cargar perfil:", err)
      return { id: userId, rol: 'cliente', estado: 'error' }
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
        // Carga rápida: getSession suele ser local si hay token
        const { data: { session } } = await supabase.auth.getSession()
        const u = session?.user ?? null
        
        if (u) {
          lastUserIdRef.current = u.id
          setUser(u)
          // Un "fake loading" rápido para no bloquear: El App.jsx se encargará de mostrar algo
          // Pero lanzamos la carga de perfil YA
          const pData = await fetchPerfilData(u.id, u)
          setPerfil(pData)
          setupRealtime(u.id)
        }
      } catch (err) {
        console.error("Fallo arranque auth:", err)
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
        // No ponemos loading=true aquí para evitar parpadeos si no es estrictamente necesario
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
  const isCliente = useMemo(() => !isAdminOrRevendedor, [isAdminOrRevendedor])

  const value = useMemo(() => ({
    user, perfil, loading, isCliente, isAdminOrRevendedor,
    login: async (email, password) => await supabase.auth.signInWithPassword({ email, password }),
    logout: async () => {
      await supabase.auth.signOut()
      setPerfil(null)
      setUser(null)
      lastUserIdRef.current = null
    },
    refetch: async () => {
       if (user) {
         const pData = await fetchPerfilData(user.id, user)
         setPerfil(pData)
       }
    }
  }), [user, perfil, loading, isCliente, isAdminOrRevendedor])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth falló: Contexto no encontrado')
  return context
}
