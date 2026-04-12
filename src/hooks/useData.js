import React, { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../utils/helpers'
import { useConfigContext } from '../context/ConfigContext'

const CartContext = createContext()
const AuthContext = createContext()

// ========================
// HOOK: Configuración Global (Ahora usa el Contexto Global)
// ========================
export function useConfiguracion() {
  return useConfigContext()
}

// ========================
// HOOK: Juegos
// ========================
export function useJuegos() {
  const [juegos, setJuegos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchJuegos() {
    const [jRes, cRes] = await Promise.all([
      supabase.from('juegos').select('*, descuento_revendedor').eq('activo', true).order('nombre'),
      supabase.from('categorias').select('*').eq('activa', true).order('orden')
    ])
    if (jRes.data) setJuegos(jRes.data)
    if (cRes.data) setCategorias(cRes.data)
    setLoading(false)
  }

  async function createJuego(data) {
    const { data: nuevo, error } = await supabase.from('juegos').insert(data).select().single()
    if (!error && nuevo) setJuegos(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return { data: nuevo, error }
  }

  async function updateJuego(id, data) {
    const { error } = await supabase.from('juegos').update(data).eq('id', id)
    if (!error) setJuegos(prev => prev.map(j => j.id === id ? { ...j, ...data } : j))
    return { error }
  }

  async function deleteJuego(id) {
    const { error } = await supabase.from('juegos').update({ activo: false }).eq('id', id)
    if (!error) setJuegos(prev => prev.filter(j => j.id !== id))
    return { error }
  }

  useEffect(() => { fetchJuegos() }, [])

  return { juegos, categorias, loading, createJuego, updateJuego, deleteJuego, refetch: fetchJuegos }
}

// ========================
// HOOK: Productos
// ========================
export function useProductos(juegoId) {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchProductos() {
    if (!juegoId) { setProductos([]); setLoading(false); return }
    const { data } = await supabase
      .from('productos')
      .select('*, descuento_revendedor')
      .eq('juego_id', juegoId)
      .order('orden')
    if (data) setProductos(data)
    setLoading(false)
  }

  async function toggleProducto(id, currentActivo) {
    const nuevoEstado = !currentActivo
    const { error } = await supabase.from('productos').update({ activo: nuevoEstado }).eq('id', id)
    if (!error) setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: nuevoEstado } : p))
    return { error }
  }

  async function createProducto(data) {
    const payload = { ...data, juego_id: juegoId }
    const { data: nuevo, error } = await supabase.from('productos').insert(payload).select().single()
    if (!error && nuevo) setProductos(prev => [...prev, nuevo])
    return { data: nuevo, error }
  }

  async function updateProducto(id, data) {
    const { error } = await supabase.from('productos').update(data).eq('id', id)
    if (!error) setProductos(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return { error }
  }

  async function deleteProducto(id) {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    
    if (error) {
      if (error.code === '23503') {
        return { error: new Error('Este paquete tiene historial de ventas o pedidos asociados y no puede borrarse definitivamente para proteger tus registros financieros. Por favor, utiliza el botón (OFF) para deshabilitarlo.') }
      }
      return { error }
    }
    
    setProductos(prev => prev.filter(p => p.id !== id))
    return { error: null }
  }

  async function reorderProductos(updates) {
    // updates = [{id, orden}, {id, orden}]
    const promises = updates.map(u =>
      supabase.from('productos').update({ orden: u.orden }).eq('id', u.id)
    )
    await Promise.all(promises)
    setProductos(prev => {
      const updated = prev.map(p => {
        const match = updates.find(u => u.id === p.id)
        return match ? { ...p, orden: match.orden } : p
      })
      return updated.sort((a, b) => (a.orden || 0) - (b.orden || 0))
    })
  }

  useEffect(() => { fetchProductos() }, [juegoId])

  return { productos, loading, createProducto, updateProducto, deleteProducto, toggleProducto, reorderProductos, refetch: fetchProductos }
}

// ========================
// HOOK: Ventas
// ========================
export function useVentas() {
  const { perfil } = useAuth()
  const [ventasHoy, setVentasHoy] = useState([])
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)

  function getLocalBounds(dateStr) {
    // dateStr in YYYY-MM-DD format
    const startObj = new Date(dateStr + 'T00:00:00-04:00');
    const endObj = new Date(dateStr + 'T23:59:59-04:00');
    return { start: startObj.toISOString(), end: endObj.toISOString() }
  }

  async function fetchVentasHoy() {
    if (!perfil?.cliente_uuid) {
       setLoading(false)
       return 
    }
    const hoy = getLocalDateString(new Date())
    const { start, end } = getLocalBounds(hoy)

    const { data: ventas } = await supabase
      .from('ventas')
      .select('*, juegos(nombre), productos(nombre)')
      .eq('vendedor_id', perfil.cliente_uuid) // AISLAMIENTO: solo ventas del admin actual
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })
      
    if (ventas) setVentasHoy(ventas)

    const arr = ventas || []
    const total_usd = arr.reduce((acc, v) => acc + Number(v.precio_venta_usd || 0), 0);
    const total_bs = arr.reduce((acc, v) => acc + Number(v.precio_venta_bs || 0), 0);
    const ganancia = arr.reduce((acc, v) => acc + Number(v.ganancia_usd || 0), 0);

    setResumen({
      fecha: hoy,
      ventas_totales_usd: total_usd,
      ventas_totales_bs: total_bs,
      ganancias_totales: ganancia,
      recargas_totales: arr.length
    })
    setLoading(false)
  }

  async function registrarVenta(producto_id, cantidad = 1, notas = '', cliente_id = null, metodo_pago_id = null, referencia_pago = '', player_id = '', account_email = '', account_password = '') {
    const { data, error } = await supabase.rpc('registrar_venta_rpc', {
      p_producto_id: producto_id,
      p_cantidad: cantidad,
      p_notas: notas,
      p_cliente_id: cliente_id,
      p_metodo_pago_id: metodo_pago_id,
      p_referencia_pago: referencia_pago,
      p_player_id: player_id,
      p_account_email: account_email,
      p_account_password: account_password,
      p_vendedor_id: perfil?.cliente_uuid // ID de cliente del admin actual
    })
    if (!error) {
      await fetchVentasHoy()
    }
    return { data, error }
  }

  async function deleteVenta(id) {
    const { error } = await supabase.from('ventas').delete().eq('id', id)
    if (!error) {
      await fetchVentasHoy()
    }
    return { error }
  }

  async function limpiarComprobantes() {
    try {
      // 1. Obtener pedidos con comprobantes de más de 20 días
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      const { data: pedidosExpirados } = await supabase
        .from('pedidos')
        .select('comprobante_url')
        .not('comprobante_url', 'is', null)
        .lt('created_at', twentyDaysAgo)

      if (pedidosExpirados && pedidosExpirados.length > 0) {
        // 2. Extraer rutas de archivos
        const pathsToDelete = pedidosExpirados.map(p => {
          const url = p.comprobante_url
          // Asumiendo formato: .../storage/v1/object/public/logos/pedidos/filename.ext
          const parts = url.split('/logos/')
          return parts.length > 1 ? parts[1] : null
        }).filter(Boolean)

        // 3. Eliminar de Storage
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('logos').remove(pathsToDelete)
        }

        // 4. Limpiar URLs en DB via RPC (ya creado en la migración 044)
        await supabase.rpc('limpiar_comprobantes_antiguos')
      }
    } catch (err) {
      console.error("Error en la limpieza de comprobantes:", err)
    }
  }

  async function fetchHistorial(fechaDesde, fechaHasta) {
    if (!perfil?.cliente_uuid) return []
    const startISO = getLocalBounds(fechaDesde).start
    const endISO = getLocalBounds(fechaHasta).end

    const { data } = await supabase
      .from('ventas')
      .select('*, juegos(nombre), productos(nombre)')
      .eq('vendedor_id', perfil.cliente_uuid) // AISLAMIENTO: solo ventas del admin actual
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
    return data || []
  }

  async function fetchResumenPeriodo(fechaDesde, fechaHasta) {
    const ventas = await fetchHistorial(fechaDesde, fechaHasta)
    
    // Agrupar manualmente por Local Date (Omitiendo la vista de DB que agrupa por la 'fecha' errónea en UTC)
    const resMap = {}
    ventas.forEach(v => {
      const d = new Date(v.created_at)
      const tzOffset = 4 * 60 * 60000; // Venezuela GMT-4
      const localDate = new Date(d.getTime() - tzOffset).toISOString().split('T')[0]
      
      if (!resMap[localDate]) {
        resMap[localDate] = { fecha: localDate, ganancias_totales: 0, ventas_totales_usd: 0, ventas_totales_bs: 0, recargas_totales: 0 }
      }
      resMap[localDate].ganancias_totales += Number(v.ganancia_usd || 0)
      resMap[localDate].ventas_totales_usd += Number(v.precio_venta_usd || 0)
      resMap[localDate].ventas_totales_bs += Number(v.precio_venta_bs || 0)
      resMap[localDate].recargas_totales += 1
    })
    
    // Retornar ordenado del más reciente al más antiguo
    return Object.values(resMap).sort((a,b) => a.fecha > b.fecha ? -1 : 1)
  }

  async function registrarVentaManual(concepto, gananciaUsd, appConfig) {
    const tasa = appConfig?.tasa_dolar || 1;
    const gananciaNumber = Number(gananciaUsd) || 0;
    const ventaBs = gananciaNumber * tasa;
    
    const { data, error } = await supabase.from('ventas').insert({
      tasa_dolar_momento: tasa,
      real_dolar_momento: appConfig?.real_dolar || tasa,
      tasa_binance_momento: appConfig?.tasa_binance || tasa,
      costo_base_momento: 0,
      margen_momento: 0,
      precio_venta_usd: gananciaNumber,
      precio_venta_bs: ventaBs,
      ganancia_usd: gananciaNumber,
      notas: concepto,
      cantidad: 1,
      vendedor_id: perfil?.cliente_uuid
    }).select().single()

    if (!error) {
      await fetchVentasHoy()
    }
    return { data, error }
  }

  useEffect(() => { 
    if (perfil?.id) fetchVentasHoy() 
    else setLoading(false) // No bloquear si no hay perfil
  }, [perfil?.id, perfil?.cliente_uuid])

  return { 
    ventasHoy, 
    resumen, 
    loading, 
    registrarVenta, 
    registrarVentaManual, 
    deleteVenta, 
    fetchHistorial, 
    fetchResumenPeriodo, 
    limpiarComprobantes,
    refetch: fetchVentasHoy 
  }
}

// ========================
// HOOK: Auth
// ========================
// ========================
// CONTEXTO: Auth (Centralizado)
// ========================
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchPerfil(userId) {
    if (!userId) return
    const { data: authUser } = await supabase.auth.getUser()
    const { data: perfilData } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle()
    let { data: clienteData } = await supabase.from('clientes').select('*').eq('auth_user_id', userId).maybeSingle()
    
    if (!clienteData && authUser?.user) {
      const u = authUser.user
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
    
    if (authUser?.user?.id === userId && authUser?.user?.email === 'ceriraga@gmail.com') {
      setPerfil({ 
        ...clienteData,
        id: userId,
        cliente_uuid: clienteData?.id,
        rol: 'admin', 
        role: 'admin', 
        estado: 'aprobado'
      })
      return
    }

    const finalRol = (perfilData?.rol || clienteData?.rol || 'cliente').toLowerCase()
    const finalEstado = (perfilData?.estado || clienteData?.estado || 'pendiente').toLowerCase()

    setPerfil({ 
      ...clienteData, 
      ...perfilData, 
      id: userId, 
      cliente_uuid: clienteData?.id || null,
      rol: finalRol,
      estado: finalEstado
    })

    if (clienteData?.id) {
       supabase.from('clientes').update({ ultima_conexion: new Date().toISOString() }).eq('id', clienteData.id).then()
    }
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

    // Carga inicial de sesión
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        await fetchPerfil(u.id)
        setupRealtime(u.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignorar TOKEN_REFRESHED para evitar re-renders innecesarios
      if (event === 'TOKEN_REFRESHED') return
      
      const u = session?.user ?? null
      
      // Solo actualizar y re-fetch si el usuario realmente cambió o es un evento importante (SIGNED_IN, SIGNED_OUT)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || (u?.id !== user?.id)) {
        setUser(u)
        if (u) {
          fetchPerfil(u.id)
          setupRealtime(u.id)
        } else {
          setPerfil(null)
          if (channel) supabase.removeChannel(channel)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, []) // Corregido: user.id ya no es dependencia directa aquí para evitar loops, el listener maneja el cambio

  async function login(email, password) {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  async function register(email, password, clientDetails) {
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
  }

  async function logout() {
    await supabase.auth.signOut()
    setPerfil(null)
    setUser(null)
  }

  async function updatePassword(newPassword) {
    return await supabase.auth.updateUser({ password: newPassword })
  }

  const isAdminOrRevendedor = ['admin', 'revendedor'].includes(perfil?.rol?.toLowerCase())
  const isCliente = !isAdminOrRevendedor

  const value = {
    user,
    perfil,
    loading,
    isCliente,
    isAdminOrRevendedor,
    login,
    register,
    logout,
    updatePassword,
    refetch: () => user && fetchPerfil(user.id)
  }

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

// ========================
// HOOK: Búsqueda Global de Productos
// ========================
export function useTodosLosProductos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchProductos() {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*, juegos!inner(*, categorias(icono))')
        .eq('activo', true)
        .eq('juegos.activo', true)
        .order('nombre')
      
      if (error) {
        console.error('Error fetching products:', error)
      } else if (data) {
        setProductos(data)
      }
    } catch (err) {
      console.error('Crash fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProductos() }, [])

  return { productos, loading, refetch: fetchProductos }
}

// ========================
// HOOK: Clientes (Usuarios)
// ========================
export function useClientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchClientes() {
    setLoading(true)
    // Traemos datos de clientes y su perfil (rol/estado)
    const [clientesRes, billeterasRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('*, perfiles:auth_user_id(rol, estado, porcentaje_descuento)')
        .order('fecha_registro', { ascending: false }),
      supabase
        .from('billeteras')
        .select('auth_user_id, saldo, saldo_bs')
    ])
    
    if (clientesRes.data) {
      const billeterasMap = new Map((billeterasRes.data || []).map(b => [b.auth_user_id, { saldo: b.saldo, saldo_bs: b.saldo_bs }]))
      // Formateamos para que sea fácil de leer en el componente
      const formatted = clientesRes.data.map(c => ({
        ...c,
        rol: c.perfiles?.rol || 'cliente',
        estado: c.perfiles?.estado || c.estado || 'pendiente',
        porcentaje_descuento: c.perfiles?.porcentaje_descuento || 0,
        billetera_saldo: billeterasMap.get(c.auth_user_id)?.saldo || 0,
        billetera_saldo_bs: billeterasMap.get(c.auth_user_id)?.saldo_bs || 0
      }))
      setClientes(formatted)
    }
    setLoading(false)
  }

  async function updateProfile(authUserId, updates) {
    // Actualizamos en la tabla clientes
    const { error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('auth_user_id', authUserId)
    
    return { error }
  }

  async function updateProfileRoleAndDiscount(authUserId, updates) {
    // 1. Upsert en perfiles
    const { error: errorProfile } = await supabase
      .from('perfiles')
      .upsert({ id: authUserId, ...updates })
    
    // 2. Si se incluye 'estado', sincronizar también en la tabla clientes
    if (!errorProfile && updates.estado) {
      await supabase
        .from('clientes')
        .update({ estado: updates.estado })
        .eq('auth_user_id', authUserId)
    }

    if (!errorProfile) {
      setClientes(prev => prev.map(c => 
        c.auth_user_id === authUserId ? { ...c, ...updates } : c
      ))
    }
    return { error: errorProfile }
  }

  async function updateProfileStatus(cliente, newStatus) {
    let finalError = null;

    // 1. Sincronizar en perfiles (si tiene auth_user_id)
    if (cliente.auth_user_id) {
      const { error } = await supabase
        .from('perfiles')
        .upsert({ id: cliente.auth_user_id, estado: newStatus })
      if (error) finalError = error;
    }

    // 2. Sincronizar SIEMPRE en la tabla clientes (esencial para el fallback de fetchPerfil)
    const { error: errorCli } = await supabase
      .from('clientes')
      .update({ estado: newStatus })
      .eq('id', cliente.id)
    
    if (errorCli) finalError = errorCli;

    if (finalError) {
      alert("Error al actualizar estado: " + finalError.message)
      return { error: finalError }
    }

    setClientes(prev => prev.map(c => 
      c.id === cliente.id ? { ...c, estado: newStatus } : c
    ))
    return { error: null }
  }

  async function createCliente(cliente) {
    const { data, error } = await supabase.from('clientes').insert([cliente]).select()
    if (!error && data) {
      setClientes(prev => [...prev, data[0]])
    }
    return { data, error }
  }

  async function updateCliente(id, updates) {
    const { data, error } = await supabase.from('clientes').update(updates).eq('id', id).select()
    if (!error && data) {
      setClientes(prev => prev.map(c => c.id === id ? data[0] : c))
    }
    return { data, error }
  }

  async function deleteCliente(id) {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (!error) {
      setClientes(prev => prev.filter(c => c.id !== id))
    }
    return { error }
  }

  async function ajustarSaldoWallet(authUserId, adminId, nuevoSaldo, nota) {
    const { data, error } = await supabase.rpc('ajustar_saldo_billetera_rpc', {
      p_user_id: authUserId,
      p_admin_id: adminId,
      p_nuevo_saldo: nuevoSaldo,
      p_nota: nota
    })
    return { data, error }
  }

  async function ajustarSaldoWalletBs(authUserId, adminId, nuevoSaldo, nota) {
    const { data, error } = await supabase.rpc('ajustar_saldo_billetera_bs_rpc', {
      p_user_id: authUserId,
      p_admin_id: adminId,
      p_nuevo_saldo: nuevoSaldo,
      p_nota: nota
    })
    return { data, error }
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  return { 
    clientes, 
    loading, 
    createCliente, 
    updateCliente, 
    deleteCliente, 
    updateProfile,
    updateProfileStatus,
    updateProfileRoleAndDiscount,
    ajustarSaldoWallet,
    ajustarSaldoWalletBs,
    refetch: fetchClientes 
  }
}
// ========================
// HOOK: Métodos de Pago
// ========================
export function useMetodosPago() {
  const [metodos, setMetodos] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchMetodos() {
    const { data } = await supabase.from('metodos_pago').select('*').order('nombre')
    if (data) setMetodos(data)
    setLoading(false)
  }

  async function createMetodo(nombre, datos, iconoUrl = null, qrUrl = null) {
    const { data, error } = await supabase
      .from('metodos_pago')
      .insert([{ nombre, datos, icono_url: iconoUrl, qr_url: qrUrl }])
      .select()
    if (!error && data) {
      setMetodos(prev => [...prev, data[0]])
    }
    return { data, error }
  }

  async function updateMetodo(id, updates) {
    const { data, error } = await supabase
      .from('metodos_pago')
      .update(updates)
      .eq('id', id)
      .select()
    if (!error && data) {
      setMetodos(prev => prev.map(m => m.id === id ? data[0] : m))
    }
    return { data, error }
  }

  async function deleteMetodo(id) {
    const { error } = await supabase.from('metodos_pago').delete().eq('id', id)
    if (!error) {
      setMetodos(prev => prev.filter(m => m.id !== id))
    }
    return { error }
  }

  async function cancelarPedidosExpirados() {
    const { data, error } = await supabase.rpc('cancelar_pedidos_expirados')
    if (error) console.error('Error al limpiar pedidos expirados:', error)
    return { data, error }
  }

  useEffect(() => { 
    fetchMetodos()
  }, [])

  return { metodos, loading, createMetodo, updateMetodo, deleteMetodo, refetch: fetchMetodos, cancelarPedidosExpirados }
}

// ========================
// HOOK: Billetera
// ========================
export function useWallet() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [recargas, setRecargas] = useState([])
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)
  const initialLoadDone = React.useRef(false)

  async function fetchWallet() {
    if (!user) return
    // Solo mostrar loading en la carga inicial
    if (!initialLoadDone.current) setLoading(true)
    
    // 1. Obtener saldo
    const { data: walletData } = await supabase
      .from('billeteras')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    
    setWallet(walletData || { saldo: 0, saldo_bs: 0 })

    // 2. Obtener recargas propias
    const { data: recargasData } = await supabase
      .from('billetera_recargas')
      .select('*, metodos_pago(nombre)')
      .eq('auth_user_id', user.id)
      .order('created_at', { ascending: false })
    
    setRecargas(recargasData || [])

    // 3. Obtener transacciones
    const { data: transData } = await supabase
      .from('billetera_transacciones')
      .select('*')
      .eq('auth_user_id', user.id)
      .order('created_at', { ascending: false })
    
    setTransacciones(transData || [])
    setLoading(false)
    initialLoadDone.current = true
  }

  async function solicitarRecarga(monto, metodoId, referencia, comprobanteUrl = null, moneda = 'usd') {
    const { data, error } = await supabase.from('billetera_recargas').insert({
      auth_user_id: user.id,
      monto,
      metodo_pago_id: metodoId,
      referencia,
      comprobante_url: comprobanteUrl,
      estado: 'pendiente',
      moneda
    }).select().single()

    if (!error) {
      await fetchWallet() // Refetch completo para actualizar historial con joins
    }
    return { data, error }
  }

  // Hook para suscripciones Realtime + polling de la billetera
  useEffect(() => {
    if (!user) return

    fetchWallet()

    // 1. Suscripción Realtime para actualizaciones instantáneas
    const channel = supabase
      .channel(`wallet_changes_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'billeteras', 
        filter: `auth_user_id=eq.${user.id}` 
      }, () => {
        fetchWallet()
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'billetera_recargas', 
        filter: `auth_user_id=eq.${user.id}` 
      }, () => {
        fetchWallet()
      })
      .subscribe()

    // 2. Polling cada 5s como respaldo si Realtime no dispara
    const interval = setInterval(fetchWallet, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [user?.id])


  return { wallet, recargas, transacciones, loading, solicitarRecarga, refetch: fetchWallet }
}

// ========================
// CONTEXTO: Carrito de Compras
// ========================
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('shopping_cart')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('shopping_cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (product, game, precioCalc, rechargeData = null) => {
    setCart(prev => {
      // Find item with same product ID AND same recharge data
      const existingIndex = prev.findIndex(item => 
        item.id === product.id &&
        item.player_id === (rechargeData?.player_id || '') &&
        item.account_email === (rechargeData?.account_email || '') &&
        item.account_user === (rechargeData?.account_user || '')
      )
      
      if (existingIndex >= 0) {
        return prev.map((item, index) => 
          index === existingIndex
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      }
      return [...prev, { 
        cart_id: Date.now().toString() + Math.random().toString(),
        id: product.id, 
        nombre: product.nombre, 
        juego: game.nombre,
        metodo_recarga: game.metodo_recarga,
        player_id: rechargeData?.player_id || '',
        account_email: rechargeData?.account_email || '',
        account_user: rechargeData?.account_user || '',
        account_password: rechargeData?.account_password || '',
        icono_url: product.icono_url || game.icono_url,
        venta_usd: precioCalc.venta_usd,
        venta_bs: precioCalc.venta_bs,
        ganancia_usd: precioCalc.ganancia_usd,
        quantity: 1
      }]
    })
  }

  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(item => item.cart_id !== cartId))
  }

  const updateQuantity = (cartId, qty) => {
    if (qty < 1) return
    setCart(prev => prev.map(item => 
      item.cart_id === cartId ? { ...item, quantity: qty } : item
    ))
  }

  const clearCart = () => setCart([])

  const checkout = async (registrarVenta, clienteId = null, metodoPagoId = null, referencia = '', activeCupon = null, ruletaDescuento = null, pedidoIdExistente = null, comprobanteUrl = null, shouldClear = true) => {
    let pedidoCreated = false
    let errorMessage = null
    let finalPedido = null
    let cuponPreInserted = false

    try {
      let pedidoTotalUSD = cart.reduce((acc, item) => acc + (item.venta_usd * item.quantity), 0)
      let pedidoTotalBs = cart.reduce((acc, item) => acc + (item.venta_bs * item.quantity), 0)

      let discountFactor = 1;
      if (activeCupon) {
        discountFactor *= (1 - activeCupon.porcentaje / 100)
      }
      if (ruletaDescuento) {
        discountFactor *= (1 - ruletaDescuento.porcentaje / 100)
      }

      pedidoTotalUSD = pedidoTotalUSD * discountFactor
      pedidoTotalBs = Math.round(pedidoTotalBs * discountFactor)

      // PASO 1: PRE-INSERTAR uso de cupón ANTES de crear el pedido.
      // Esto activa el trigger con advisory lock en la BD, que bloquea
      // cualquier uso duplicado ANTES de que el pedido (con descuento) exista.
      if (activeCupon && clienteId) {
        const { error: cuponError } = await supabase.from('cupones_usados').insert({
          cupon_id: activeCupon.id,
          cliente_id: clienteId,
          pedido_id: null // Se actualiza después de crear el pedido
        })
        if (cuponError) {
          // El trigger bloqueó el uso – el cupón ya fue utilizado
          throw new Error('CUPON_YA_USADO: Este cupón ya fue utilizado o superaste el límite de usos permitidos.')
        }
        cuponPreInserted = true
      }

      // PASO 2: Crear o Actualizar el pedido
      let pedido, pedidoError;

      if (pedidoIdExistente) {
        const { data: updPedido, error: updError } = await supabase
          .from('pedidos')
          .update({
            metodo_pago_id: metodoPagoId || null,
            referencia_pago: referencia,
            total_usd: pedidoTotalUSD,
            total_bs: pedidoTotalBs,
            comprobante_url: comprobanteUrl || undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', pedidoIdExistente)
          .select()
          .single()
        pedido = updPedido
        pedidoError = updError
      } else {
        const { data: insPedido, error: insError } = await supabase
          .from('pedidos')
          .insert({
            cliente_id: clienteId || null,
            metodo_pago_id: metodoPagoId || null,
            referencia_pago: referencia,
            estado: 'pendiente',
            total_usd: pedidoTotalUSD,
            total_bs: pedidoTotalBs,
            comprobante_url: comprobanteUrl || null,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
        pedido = insPedido
        pedidoError = insError
      }

      if (!pedidoError && pedido) {
        finalPedido = pedido
        
        // Si el pedido es nuevo, insertar items. Si es existente, los items ya están allí (o podrían actualizarse, pero para este flujo asumiremos que se crean al inicio)
        if (!pedidoIdExistente) {
          const items = cart.map(item => ({
            pedido_id: finalPedido.id,
            producto_id: item.id,
            juego_nombre: item.juego,
            producto_nombre: item.nombre,
            cantidad: item.quantity,
            precio_usd: +(item.venta_usd * item.quantity).toFixed(2),
            precio_bs: Math.round(item.venta_bs * item.quantity),
            metodo_recarga: item.metodo_recarga || 'id_jugador',
            player_id: item.player_id || '',
            account_email: item.account_email || item.account_user || '',
            account_password: item.account_password || ''
          }))
          const { error: itemsError } = await supabase.from('pedido_items').insert(items)
          if (itemsError) throw itemsError
        }

        // PASO 3: Actualizar el registro de cupón con el pedido_id real
        if (activeCupon && clienteId && cuponPreInserted) {
          await supabase.from('cupones_usados')
            .update({ pedido_id: finalPedido.id })
            .eq('cupon_id', activeCupon.id)
            .eq('cliente_id', clienteId)
            .is('pedido_id', null)
        }
        
        pedidoCreated = true
      } else {
        errorMessage = pedidoError?.message || 'Error al guardar el pedido'
        console.error('Error creando pedido:', pedidoError)
        // CLEANUP: Si el pedido falló pero el cupón fue pre-insertado, eliminarlo
        if (cuponPreInserted && activeCupon && clienteId) {
          await supabase.from('cupones_usados')
            .delete()
            .eq('cupon_id', activeCupon.id)
            .eq('cliente_id', clienteId)
            .is('pedido_id', null)
        }
      }
    } catch (e) {
      errorMessage = e.message || 'Error inesperado al procesar el pedido'
      console.error('Error creando pedido:', e)
      // CLEANUP: Si hubo excepción y el cupón fue pre-insertado, eliminarlo
      if (cuponPreInserted && activeCupon && clienteId) {
        await supabase.from('cupones_usados')
          .delete()
          .eq('cupon_id', activeCupon.id)
          .eq('cliente_id', clienteId)
          .is('pedido_id', null)
        cuponPreInserted = false
      }
    }

    if (pedidoCreated && shouldClear) {
      clearCart()
    }

    return pedidoCreated
      ? [{ id: 'pedido', error: null, data: finalPedido }]
      : [{ id: 'pedido', error: errorMessage || 'No se pudo crear el pedido' }]
  }

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)
  const totalUSD = cart.reduce((acc, item) => acc + (item.venta_usd * item.quantity), 0)
  const totalBs = Math.round(cart.reduce((acc, item) => acc + (item.venta_bs * item.quantity), 0))

  return React.createElement(CartContext.Provider, {
    value: { 
      cart, addToCart, removeFromCart, updateQuantity, clearCart, checkout, 
      totalItems, totalUSD, totalBs 
    }
  }, children)
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart debe usarse dentro de un CartProvider')
  }
  return context
}

// ========================
// HOOK: Mensajes del Sistema (Pop-ups)
// ========================
export function useMensajesSistema() {
  const [mensajes, setMensajes] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchMensajes() {
    const { data, error } = await supabase
      .from('mensajes_sistema')
      .select('*')
      .order('creado_at', { ascending: false })
    
    if (!error && data) setMensajes(data)
    setLoading(false)
  }

  async function createMensaje(mensaje) {
    const { data, error } = await supabase
      .from('mensajes_sistema')
      .insert([mensaje])
      .select()
      .single()
    
    if (!error && data) setMensajes(prev => [data, ...prev])
    return { data, error }
  }

  async function updateMensaje(id, updates) {
    const { data, error } = await supabase
      .from('mensajes_sistema')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (!error && data) setMensajes(prev => prev.map(m => m.id === id ? data : m))
    return { data, error }
  }

  async function deleteMensaje(id) {
    const { error } = await supabase
      .from('mensajes_sistema')
      .delete()
      .eq('id', id)
    
    if (!error) setMensajes(prev => prev.filter(m => m.id !== id))
    return { error }
  }

  useEffect(() => {
    fetchMensajes()
  }, [])

  return { mensajes, loading, createMensaje, updateMensaje, deleteMensaje, refetch: fetchMensajes }
}

// ========================
// HOOK: Notificaciones en Vivo (Push)
// ========================
export function useNotificacionesPush() {
  async function enviarNotificacion(notificacion, duracionHoras = 1) {
    const expira_at = new Date(Date.now() + duracionHoras * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('notificaciones_clientes')
      .insert([{ ...notificacion, expira_at }])
      .select()
    return { data, error }
  }

  async function fetchNotificacionesActivas() {
    const { data, error } = await supabase
      .from('notificaciones_clientes')
      .select('*')
      .gt('expira_at', new Date().toISOString())
      .order('creado_at', { ascending: false })
      .limit(5)
    return { data, error }
  }

  return { enviarNotificacion, fetchNotificacionesActivas }
}
