import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../utils/helpers'
import { useConfigContext } from '../context/ConfigContext'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

// Re-exportar todo para mantener compatibilidad con el resto de la app
export { useAuth, AuthProvider } from '../context/AuthContext'
export { useCart, CartProvider } from '../context/CartContext'
export { useConfigContext as useConfiguracion } from '../context/ConfigContext'

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
      .eq('vendedor_id', perfil.cliente_uuid)
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
      p_vendedor_id: perfil?.cliente_uuid
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
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      const { data: pedidosExpirados } = await supabase
        .from('pedidos')
        .select('comprobante_url')
        .not('comprobante_url', 'is', null)
        .lt('created_at', twentyDaysAgo)

      if (pedidosExpirados && pedidosExpirados.length > 0) {
        const pathsToDelete = pedidosExpirados.map(p => {
          const url = p.comprobante_url
          const parts = url.split('/logos/')
          return parts.length > 1 ? parts[1] : null
        }).filter(Boolean)

        if (pathsToDelete.length > 0) {
          await supabase.storage.from('logos').remove(pathsToDelete)
        }
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
      .eq('vendedor_id', perfil.cliente_uuid)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
    return data || []
  }

  async function fetchResumenPeriodo(fechaDesde, fechaHasta) {
    const ventas = await fetchHistorial(fechaDesde, fechaHasta)
    const resMap = {}
    ventas.forEach(v => {
      const d = new Date(v.created_at)
      const tzOffset = 4 * 60 * 60000;
      const localDate = new Date(d.getTime() - tzOffset).toISOString().split('T')[0]
      
      if (!resMap[localDate]) {
        resMap[localDate] = { fecha: localDate, ganancias_totales: 0, ventas_totales_usd: 0, ventas_totales_bs: 0, recargas_totales: 0 }
      }
      resMap[localDate].ganancias_totales += Number(v.ganancia_usd || 0)
      resMap[localDate].ventas_totales_usd += Number(v.precio_venta_usd || 0)
      resMap[localDate].ventas_totales_bs += Number(v.precio_venta_bs || 0)
      resMap[localDate].recargas_totales += 1
    })
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
    else setLoading(false)
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
    const { error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('auth_user_id', authUserId)
    return { error }
  }

  async function updateProfileRoleAndDiscount(authUserId, updates) {
    const { error: errorProfile } = await supabase
      .from('perfiles')
      .upsert({ id: authUserId, ...updates })
    
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
    if (cliente.auth_user_id) {
      const { error } = await supabase
        .from('perfiles')
        .upsert({ id: cliente.auth_user_id, estado: newStatus })
      if (error) finalError = error;
    }

    const { error: errorCli } = await supabase
      .from('clientes')
      .update({ estado: newStatus })
      .eq('id', cliente.id)
    
    if (errorCli) finalError = errorCli;
    if (finalError) return { error: finalError }

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
  const initialLoadDone = useRef(false)

  async function fetchWallet() {
    if (!user) return
    if (!initialLoadDone.current) setLoading(true)
    const { data: walletData } = await supabase
      .from('billeteras')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    setWallet(walletData || { saldo: 0, saldo_bs: 0 })

    const { data: recargasData } = await supabase
      .from('billetera_recargas')
      .select('*, metodos_pago(nombre)')
      .eq('auth_user_id', user.id)
      .order('created_at', { ascending: false })
    setRecargas(recargasData || [])

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
      referencia_pago: referencia,
      comprobante_url: comprobanteUrl,
      moneda
    }).select()
    return { data, error }
  }

  useEffect(() => {
    fetchWallet()
  }, [user])

  return { wallet, recargas, transacciones, loading, solicitarRecarga, refetch: fetchWallet }
}

// ========================
// HOOK: Mensajes del Sistema
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
// HOOK: Notificaciones Push
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
