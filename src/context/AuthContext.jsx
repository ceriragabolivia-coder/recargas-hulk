import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

function buildRoles(rolPrincipal, rolesAdicionales) {
  const extra = (rolesAdicionales || []).map(r => r.rol?.toLowerCase()).filter(Boolean)
  return Array.from(new Set([rolPrincipal?.toLowerCase(), ...extra].filter(Boolean)))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const lastUserIdRef = useRef(null)
  const isInitializedRef = useRef(false)

  // Carga de Perfil optimizada con modo VIP y Failsafe (Incluye Billetera)
  async function fetchPerfilData(userId, authUser = null) {
    if (!userId) return null
    
    const u = authUser || (await supabase.auth.getUser()).data?.user
    const isSuperAdmin = u?.email === 'recargashulk@gmail.com'
    
    // 1. MODO VELOZ: Retorno rápido para evitar esperas en la UI
    // Si es SuperAdmin, retornamos admin instantáneo. Si no, esperamos un poco.
    if (isSuperAdmin) {

      const fetchFullDetails = async () => {
        const [resP, resC, resB, resRA] = await Promise.all([
          supabase.from('perfiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle(),
          supabase.from('billeteras').select('*').eq('auth_user_id', userId).maybeSingle(),
          supabase.from('usuario_roles_adicionales').select('rol').eq('usuario_id', userId)
        ]);

        let perfilData = resP.data;
        if (!perfilData && u) {
          const { data: nuevoP } = await supabase.from('perfiles').insert({
            id: userId,
            rol: 'admin',
            estado: 'aprobado'
          }).select().maybeSingle();
          perfilData = nuevoP;
        }

        let clienteData = resC.data;
        if (!clienteData && u) {
          const { data: nuevo } = await supabase.from('clientes').insert({
            auth_user_id: userId,
            nombres: u.user_metadata?.nombres || 'Administrador',
            apellidos: u.user_metadata?.apellidos || 'Ceriraga',
            usuario: u.email,
            nickname: 'Admin',
            estado: 'aprobado'
          }).select().maybeSingle();
          clienteData = nuevo;
        }

        const rolPrincipal = perfilData?.rol || 'admin';
        const roles = buildRoles(rolPrincipal, resRA.data);

        setPerfil(prev => ({
          ...prev,
          ...clienteData,
          ...perfilData,
          ...resB.data,
          cliente_uuid: clienteData?.id || prev?.cliente_uuid,
          rol: rolPrincipal,
          roles,
          is_vip: true
        }));
      };

      fetchFullDetails();

      return {
        id: userId,
        rol: 'admin',
        roles: ['admin'],
        estado: 'aprobado',
        nombres: 'Administrador',
        nickname: 'Admin',
        is_vip: true
      }
    }

    try {
      // 2. Consulta paralela con Timeout (Failsafe)
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
      
      const fetchPromise = (async () => {
        const [resP, resC, resB, resRA] = await Promise.all([
          supabase.from('perfiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle(),
          supabase.from('billeteras').select('*').eq('auth_user_id', userId).maybeSingle(),
          supabase.from('usuario_roles_adicionales').select('rol').eq('usuario_id', userId)
        ])

        let perfilData = resP.data
        let clienteData = resC.data
        const walletData = resB.data
        const rolesAdicionales = resRA.data
        
        // Intercepción para Forzar Cierre de Sesión (__FORCE_LOGOUT__)
        if (perfilData?.motivo_estado && perfilData.motivo_estado.includes('__FORCE_LOGOUT__')) {
            const newMotivo = perfilData.motivo_estado.replace('__FORCE_LOGOUT__', '').trim();
            await supabase.from('perfiles').update({ motivo_estado: newMotivo || null }).eq('id', userId);
            await supabase.auth.signOut();
            window.location.href = '/';
            return null;
        }
        
        // Auto-creación de perfil si no existe
        if (!perfilData && u) {
          const { data: nuevoPerfil } = await supabase.from('perfiles').insert({
            id: userId,
            rol: 'cliente',
            estado: 'aprobado'
          }).select().maybeSingle()
          // No sobreescribir perfilData si falló el insert, pero si funcionó usarlo
          if (nuevoPerfil) perfilData = nuevoPerfil
        }

        // Auto-creación de cliente si no existe (PARA TODOS LOS USUARIOS, INCLUYENDO ADMINS)
        if (!clienteData && u) {
          const { data: nuevoCliente } = await supabase.from('clientes').insert({
            auth_user_id: userId,
            nombres: u.user_metadata?.nombres || u.email?.split('@')[0] || 'Usuario',
            apellidos: u.user_metadata?.apellidos || '',
            usuario: u.email || userId,
            nickname: u.user_metadata?.nickname || 'Usuario',
            whatsapp: u.user_metadata?.whatsapp || '',
            estado: 'aprobado' // Por defecto aprobado para que puedan operar
          }).select().maybeSingle()
          clienteData = nuevoCliente
        }

        const rolPrincipal = (perfilData?.rol || clienteData?.rol || 'cliente').toLowerCase()

        return {
          ...clienteData,
          ...perfilData,
          ...walletData,
          id: userId,
          cliente_uuid: clienteData?.id || null,
          rol: rolPrincipal,
          roles: buildRoles(rolPrincipal, rolesAdicionales),
          estado: (perfilData?.estado || clienteData?.estado || 'pendiente').toLowerCase(),
          config_modulos: perfilData?.config_modulos || (perfilData?.rol === 'negocio' ? ['dashboard', 'productos', 'ventas', 'reportes'] : []),
          is_vip: false
        }
      })()

      return await Promise.race([fetchPromise, timeoutPromise])
    } catch (err) {
      return { id: userId, rol: 'cliente', roles: ['cliente'], estado: 'cargando', is_fallback: true }
    }
  }

  useEffect(() => {
    let channel;

    const setupRealtime = (userId) => {
      if (channel) supabase.removeChannel(channel)

      const refreshRoles = async (rolPrincipal) => {
        const { data: rolesAdicionales } = await supabase
          .from('usuario_roles_adicionales')
          .select('rol')
          .eq('usuario_id', userId)
        setPerfil(prev => ({ ...prev, roles: buildRoles(rolPrincipal ?? prev?.rol, rolesAdicionales) }))
      }

      channel = supabase
        .channel(`auth_perfil_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'perfiles', filter: `id=eq.${userId}`
        }, payload => {
           if (payload.new?.motivo_estado && payload.new.motivo_estado.includes('__FORCE_LOGOUT__')) {
               const newMotivo = payload.new.motivo_estado.replace('__FORCE_LOGOUT__', '').trim();
               supabase.from('perfiles').update({ motivo_estado: newMotivo || null }).eq('id', userId).then(() => {
                   supabase.auth.signOut().then(() => {
                       window.location.href = '/';
                   });
               });
           } else {
               setPerfil(prev => ({ ...prev, ...payload.new }))
               refreshRoles(payload.new?.rol)
           }
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'usuario_roles_adicionales', filter: `usuario_id=eq.${userId}`
        }, () => {
           refreshRoles()
        })
        .subscribe()
    }

    const initializeAuth = async () => {
      if (isInitializedRef.current) return
      isInitializedRef.current = true

      try {
        const sessionPromise = supabase.auth.getSession()
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LOCK')), 8000))
        
        const { data: { session } } = await Promise.race([sessionPromise, timeout])
        const u = session?.user ?? null
        
        if (u) {
          lastUserIdRef.current = u.id
          setUser(u)
          const pData = await fetchPerfilData(u.id, u)
          
          // Actualización atómica para evitar parpadeos
          if (pData) {
            setPerfil(pData)
            setupRealtime(u.id)
          }
        }
      } catch (err) {
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') return
      
      const u = session?.user ?? null
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('admin_welcome_played')
        sessionStorage.removeItem('client_welcome_played')
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
        // Solo marcar loading si no estamos ya en proceso de inicialización
        if (!isInitializedRef.current) setLoading(true)
        
        const pData = await fetchPerfilData(u.id, u)
        
        // Actualización atómica
        if (pData) {
          setPerfil(pData)
          setupRealtime(u.id)
        }
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [])


  const isAdminOrRevendedor = useMemo(() =>
    (perfil?.roles || [perfil?.rol?.toLowerCase()]).some(r => ['admin', 'revendedor'].includes(r)),
    [perfil?.rol, perfil?.roles]
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
    register: async (email, password, metadata) => {
      setLoading(true)
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
      })
      if (res.error) setLoading(false)
      return res
    },
    logout: async () => {
      setLoading(true)
      sessionStorage.removeItem('admin_welcome_played')
      sessionStorage.removeItem('client_welcome_played')
      await supabase.auth.signOut()
      setPerfil(null)
      setUser(null)
      lastUserIdRef.current = null
      setLoading(false)
    },
    refetch: async () => {
       const u = (await supabase.auth.getUser()).data?.user
       if (u) {
         const pData = await fetchPerfilData(u.id, u)
         setPerfil(pData)
       }
    },
    refreshPerfil: async () => {
       const u = (await supabase.auth.getUser()).data?.user
       if (u) {
         const pData = await fetchPerfilData(u.id, u)
         setPerfil(pData)
       }
    },
    updatePassword: async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      return { error }
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
