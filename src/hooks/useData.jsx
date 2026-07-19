import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../utils/helpers'
import { useConfigContext } from '../context/ConfigContext'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useWallet } from '../context/WalletContext'
import { processTiendaGiftVenOrder } from '../utils/apiProcessor'
import { applyClientCashback } from '../utils/cashbackUtils'

// Re-exportar todo para mantener compatibilidad con el resto de la app
export { useAuth, AuthProvider } from '../context/AuthContext'
export { useCart, CartProvider } from '../context/CartContext'
export { useWallet, WalletProvider } from '../context/WalletContext'
export { useConfigContext as useConfiguracion } from '../context/ConfigContext'

// ========================
// HOOK: Juegos
// ========================
export function useJuegos() {
  const [juegos, setJuegos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)

  const { perfil, user } = useAuth()
  const isNegocio = perfil?.rol === 'negocio'

  async function fetchJuegos() {
    let jSelect = supabase.from('juegos').select('*').eq('activo', true)
    let cSelect = supabase.from('categorias').select('*').eq('activa', true)

    if (isNegocio) {
      jSelect = jSelect.eq('owner_id', user.id)
      cSelect = cSelect.eq('owner_id', user.id)
    } else {
      jSelect = jSelect.is('owner_id', null)
      cSelect = cSelect.is('owner_id', null)
    }

    const [jRes, cRes] = await Promise.all([
      jSelect.order('nombre'),
      cSelect.order('orden')
    ])
    
    if (jRes.data) setJuegos(jRes.data)
    if (cRes.data) setCategorias(cRes.data)
    setLoading(false)
  }

  async function createJuego(data) {
    const payload = isNegocio ? { ...data, owner_id: user.id } : data
    // Forzar que los juegos nuevos aparezcan al final de la landing page por defecto
    payload.orden_landing = 999
    
    const { data: nuevo, error } = await supabase.from('juegos').insert(payload).select().single()
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
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { perfil, user } = useAuth()
  const isNegocio = perfil?.rol === 'negocio'

  async function fetchProductos() {
    if (!juegoId) { setProductos([]); setLoading(false); return }
    let query = supabase
      .from('productos')
      .select('*')
      .eq('juego_id', juegoId)

    if (isNegocio) {
      query = query.eq('owner_id', user.id)
    } else {
      query = query.is('owner_id', null)
    }

    const { data, error: dbError } = await query.order('orden')
    if (dbError) setError(dbError)
    if (data) setProductos(data)
    setLoading(false)
  }

  async function toggleProducto(id, currentActivo) {
    const nuevoEstado = !currentActivo
    const { error: dbError } = await supabase.from('productos').update({ activo: nuevoEstado }).eq('id', id)
    if (!dbError) setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: nuevoEstado } : p))
    return { error: dbError }
  }

  async function fetchCategorias() {
    let query = supabase.from('categorias').select('*')
    if (isNegocio) {
      query = query.eq('owner_id', user.id)
    } else {
      query = query.is('owner_id', null)
    }
    const { data, error: dbError } = await query.order('orden')
    if (dbError) setError(dbError)
    if (data) setCategorias(data)
    setLoading(false)
  }

  async function createCategoria(data) {
    const payload = isNegocio ? { ...data, owner_id: user.id } : data
    const { data: nuevo, error: dbError } = await supabase.from('categorias').insert(payload).select().single()
    if (!dbError && nuevo) setCategorias(prev => [...prev, nuevo])
    return { data: nuevo, error: dbError }
  }

  async function updateCategoria(id, data) {
    const { error: dbError } = await supabase.from('categorias').update(data).eq('id', id)
    if (!dbError) setCategorias(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { error: dbError }
  }

  async function deleteCategoria(id) {
    const { error: dbError } = await supabase.from('categorias').delete().eq('id', id)
    if (!dbError) setCategorias(prev => prev.filter(c => c.id !== id))
    return { error: dbError }
  }

  async function createProducto(data) {
    const payload = { ...data, juego_id: juegoId }
    if (isNegocio) payload.owner_id = user.id
    const { data: nuevo, error: dbError } = await supabase.from('productos').insert(payload).select().single()
    if (!dbError && nuevo) setProductos(prev => [...prev, nuevo])
    return { data: nuevo, error: dbError }
  }

  async function updateProducto(id, data) {
    const { error: dbError } = await supabase.from('productos').update(data).eq('id', id)
    if (!dbError) setProductos(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    return { error: dbError }
  }

  async function deleteProducto(id) {
    const { error: dbError } = await supabase.from('productos').delete().eq('id', id)
    
    if (dbError) {
      if (dbError.code === '23503') {
        return { error: new Error('Este paquete tiene historial de ventas o pedidos asociados y no puede borrarse definitivamente para proteger tus registros financieros. Por favor, utiliza el botón (OFF) para deshabilitarlo.') }
      }
      return { error: dbError }
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

  useEffect(() => { fetchProductos(); fetchCategorias() }, [juegoId])

  return { productos, categorias, loading, error, createProducto, updateProducto, deleteProducto, toggleProducto, reorderProductos, createCategoria, updateCategoria, deleteCategoria, refetch: fetchProductos }
}

// ========================
// HOOK: Ventas
// ========================
export function useVentas() {
  const { perfil, user } = useAuth()
  const [ventasHoy, setVentasHoy] = useState([])
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastForceOwnSalesRef = useRef(false)

  function getLocalBounds(dateStr) {
    const startObj = new Date(dateStr + 'T00:00:00-04:00');
    const endObj = new Date(dateStr + 'T23:59:59-04:00');
    return { start: startObj.toISOString(), end: endObj.toISOString() }
  }

  const isNegocio = perfil?.rol === 'negocio'

  async function fetchVentasHoy(forceOwnSales = false) {
    lastForceOwnSalesRef.current = forceOwnSales
    const hoy = getLocalDateString(new Date())
    const { start, end } = getLocalBounds(hoy)
    console.log(`📊 Fetching sales from ${start} to ${end}`)

    let query = supabase
      .from('ventas')
      .select(`
        *,
        juegos(nombre),
        productos(nombre),
        vendedor:vendedor_id(nombres, apellidos, nickname),
        pedido:pedido_id(
          *,
          pedido_items(*, productos(*, juegos(*)))
        )
      `)
      .gte('created_at', start)
      .lte('created_at', end)

    if (isNegocio) {
      query = query.eq('owner_id', user.id)
    }

    query = query.order('created_at', { ascending: false })

    const userEmail = user?.email?.toLowerCase()
    const isSuperAdmin = userEmail === 'recargashulk@gmail.com'

    if ((!isSuperAdmin || forceOwnSales) && perfil?.cliente_uuid) {
      console.log(`🎯 Filtering sales for vendedor_id: ${perfil.cliente_uuid}`)
      query = query.eq('vendedor_id', perfil.cliente_uuid)
    } else if (!isSuperAdmin && !perfil?.cliente_uuid) {
      console.log('⚠️ Admin without profile UUID, filtering with safety ID')
      query = query.eq('vendedor_id', '00000000-0000-0000-0000-000000000000')
    } else {
      console.log('👑 SuperAdmin: Loading Global Sales')
    }

    const { data: ventas } = await query
      
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
      p_vendedor_id: perfil?.cliente_uuid,
      p_owner_id: isNegocio ? user.id : null
    })

    if (!error) {
      await fetchVentasHoy()

      // =========== INTEGRACIÓN APK: AUTO-DESPACHO ===========
      try {
        if (referencia_pago) {
          // data suele contener el success y el pedido_id en este sistema, o el id directamente
          const pedidoId = data?.pedido_id || data?.id || (typeof data === 'number' ? data : null);
          
          if (pedidoId) {
            const { data: apkPago } = await supabase
              .from('pagos_apk')
              .select('id, monto')
              .eq('referencia', referencia_pago)
              .eq('status', 'disponible')
              .single();
              
            if (apkPago) {
              // Actualizamos pagos_apk para marcarlo como usado
              await supabase.from('pagos_apk').update({
                status: 'usado',
                pedido_id: pedidoId,
                usuario_id: perfil?.id || cliente_id
              }).eq('id', apkPago.id);

              // Auto-despachar el pedido recién creado (baúl)
              const { data: rpcData } = await supabase.rpc('procesar_pedido_automatico_rpc', {
                p_pedido_id: pedidoId
              });
              const baulSuccess = (rpcData?.success && rpcData?.completado) || false;
              
              if (baulSuccess) {
                 await applyClientCashback(pedidoId, perfil?.id || cliente_id);
              } else {
                // Si no se procesó por el baúl, intentamos con la API
                await processTiendaGiftVenOrder(pedidoId, null, false).catch(() => false);
              }
              console.log(`✅ Pedido ${pedidoId} auto-despachado desde el cliente (APK previo).`);
            }
          }
        }
      } catch (e) {
        console.error('Error verificando pagos_apk desde el registrarVenta:', e);
      }
      // =======================================================
    }
    return { data, error }
  }

  async function verificarYRegistrarReferencia(referencia, monto, origen) {
    const { data, error } = await supabase.rpc('validar_y_registrar_referencia_rpc', {
      p_referencia: referencia,
      p_monto: monto,
      p_usuario_id: perfil?.id, // ID de la cuenta (Auth)
      p_origen: origen
    })
    
    if (error) throw error
    if (data && !data.success) {
      throw new Error(data.message)
    }

    // =========== INTEGRACIÓN APK: AUTO-DESPACHO ===========
    // Si la referencia es válida y se registró, vamos a verificar si EL APK ya la había reportado previamente.
    try {
      if (origen === 'pedido' && data?.pedido_id) {
        const { data: apkPago } = await supabase
          .from('pagos_apk')
          .select('id, monto')
          .eq('referencia', referencia)
          .eq('status', 'disponible')
          .single();
          
        if (apkPago) {
          // Validar el monto con una tolerancia de redondeo
          if (Math.abs(parseFloat(apkPago.monto) - parseFloat(monto)) <= 0.05) {
            // Actualizamos pagos_apk para marcarlo como usado
            await supabase.from('pagos_apk').update({
              status: 'usado',
              pedido_id: data.pedido_id,
              usuario_id: perfil?.id
            }).eq('id', apkPago.id);

            // Auto-despachar el pedido recién creado (baúl)
            const { data: rpcData } = await supabase.rpc('procesar_pedido_automatico_rpc', {
              p_pedido_id: data.pedido_id
            });
            const baulSuccess = (rpcData?.success && rpcData?.completado) || false;
            
            if (baulSuccess) {
               await applyClientCashback(data.pedido_id, perfil?.id);
            } else {
              // Si no se procesó por el baúl, intentamos con la API
              await processTiendaGiftVenOrder(data.pedido_id, null, false).catch(() => false);
            }
            console.log(`✅ Pedido ${data.pedido_id} auto-despachado desde el cliente (APK previo).`);
          }
        }
      }
    } catch (e) {
      console.error('Error verificando pagos_apk desde el cliente:', e);
    }
    // =======================================================

    return data
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

  async function fetchHistorial(fechaDesde, fechaHasta, forceOwnSales = false) {
    const startISO = getLocalBounds(fechaDesde).start
    const endISO = getLocalBounds(fechaHasta).end

    let query = supabase
      .from('ventas')
      .select(`
        *,
        juegos(nombre),
        productos(nombre),
        vendedor:vendedor_id(nombres, apellidos, nickname),
        pedido:pedido_id(
          *,
          pedido_items(*, productos(*, juegos(*)))
        )
      `)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })

    if (isNegocio) {
      query = query.eq('owner_id', user.id)
    } else {
      query = query.is('owner_id', null)
    }

    if ((user?.email !== 'recargashulk@gmail.com' || forceOwnSales) && perfil?.cliente_uuid) {
      query = query.eq('vendedor_id', perfil.cliente_uuid)
    } else if (user?.email !== 'recargashulk@gmail.com' && !perfil?.cliente_uuid) {
      query = query.eq('vendedor_id', '00000000-0000-0000-0000-000000000000')
    }

    const { data } = await query
    return data || []
  }

  async function fetchResumenPeriodo(fechaDesde, fechaHasta, forceOwnSales = false) {
    const ventas = await fetchHistorial(fechaDesde, fechaHasta, forceOwnSales)
    const resMap = {}
    ventas.forEach(v => {
      const d = new Date(v.created_at)
      const localDate = getLocalDateString(d)
      
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
    
    const insertPayload = {
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
      vendedor_id: perfil?.cliente_uuid,
      owner_id: isNegocio ? user.id : null
    }

    const { data, error } = await supabase.from('ventas').insert(insertPayload).select().single()

    if (!error) {
      await fetchVentasHoy()
    }
    return { data, error }
  }

  useEffect(() => {
    if (!perfil?.id) return

    // Suscripción Realtime para la tabla ventas
    const channel = supabase
      .channel('ventas_realtime_hook')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ventas' 
      }, (payload) => {
        console.log('🔄 Venta detectada (Realtime), actualizando resumen...', payload)
        fetchVentasHoy(lastForceOwnSalesRef.current)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [perfil?.id])

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
    verificarYRegistrarReferencia,
    refetch: fetchVentasHoy 
  }
}

// ========================
// HOOK: Búsqueda Global de Productos
// ========================
export function useTodosLosProductos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const { perfil, user } = useAuth()
  const isNegocio = perfil?.rol === 'negocio'

  async function fetchProductos() {
    try {
      let query = supabase
        .from('productos')
        .select('*, juegos!inner(*, categorias(*))')
        .eq('activo', true)
        .eq('juegos.activo', true)

      if (isNegocio) {
        query = query.eq('owner_id', user.id)
      }

      const { data, error } = await query.order('nombre')
      
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

  useEffect(() => {
    fetchProductos()
  }, [])

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
    const [clientesRes, perfilesRes, billeterasRes, rolesAdicionalesRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .order('fecha_registro', { ascending: false }),
      supabase
        .from('perfiles')
        .select('id, rol, estado, porcentaje_descuento, config_modulos, motivo_estado, juegos_deshabilitados'),
      supabase
        .from('billeteras')
        .select('auth_user_id, saldo, saldo_bs'),
      supabase
        .from('usuario_roles_adicionales')
        .select('usuario_id, rol')
    ])

    if (clientesRes.data) {
      const perfilesMap = new Map((perfilesRes.data || []).map(p => [p.id, p]))
      const billeterasMap = new Map((billeterasRes.data || []).map(b => [b.auth_user_id, { saldo: b.saldo, saldo_bs: b.saldo_bs }]))
      const rolesAdicionalesMap = new Map()
      ;(rolesAdicionalesRes.data || []).forEach(r => {
        const lista = rolesAdicionalesMap.get(r.usuario_id) || []
        lista.push(r.rol)
        rolesAdicionalesMap.set(r.usuario_id, lista)
      })

      const formatted = clientesRes.data.map(c => {
        const p = perfilesMap.get(c.auth_user_id)
        return {
          ...c,
          rol: p?.rol || 'cliente',
          estado: p?.estado || c.estado || 'pendiente',
          porcentaje_descuento: p?.porcentaje_descuento || 0,
          config_modulos: p?.config_modulos || [],
          motivo_estado: p?.motivo_estado || null,
          juegos_deshabilitados: p?.juegos_deshabilitados || [],
          roles_adicionales: rolesAdicionalesMap.get(c.auth_user_id) || [],
          billetera_saldo: billeterasMap.get(c.auth_user_id)?.saldo || 0,
          billetera_saldo_bs: billeterasMap.get(c.auth_user_id)?.saldo_bs || 0
        }
      })
      setClientes(formatted)
    }
    setLoading(false)
  }

  async function updateProfile(authUserId, updates) {
    // Usar RPC para asegurar persistencia y evitar problemas de RLS
    const { data, error: rpcError } = await supabase.rpc('actualizar_perfil_usuario_rpc', {
      p_user_id: authUserId,
      p_avatar_url: updates.avatar_url || null,
      p_nickname: updates.nickname || null,
      p_whatsapp: updates.whatsapp || null
    })

    if (rpcError) return { error: rpcError }
    if (data && !data.success) return { error: new Error(data.message) }

    return { error: null }
  }

  async function updateProfileRoleAndDiscount(authUserId, updates) {
    const { data, error } = await supabase.rpc('admin_update_profile_role', {
      p_user_id: authUserId,
      p_rol: updates.rol,
      p_estado: updates.estado || null,
      p_porcentaje_descuento: updates.porcentaje_descuento || 0,
      p_config_modulos: updates.config_modulos || [],
      p_motivo: updates.motivo_estado || null,
      p_juegos_deshabilitados: updates.juegos_deshabilitados || []
    })
    
    if (error) return { error }
    if (data && !data.success) return { error: new Error(data.message) }

    setClientes(prev => prev.map(c =>
      c.auth_user_id === authUserId ? { ...c, ...updates } : c
    ))
    return { error: null }
  }

  async function updateRolesAdicionales(authUserId, roles) {
    const { data, error } = await supabase.rpc('admin_set_roles_adicionales', {
      p_user_id: authUserId,
      p_roles: roles || []
    })

    if (error) return { error }
    if (data && !data.success) return { error: new Error(data.message) }

    setClientes(prev => prev.map(c =>
      c.auth_user_id === authUserId ? { ...c, roles_adicionales: roles || [] } : c
    ))
    return { error: null }
  }

  async function updateProfileStatus(cliente, newStatus, motivo = null) {
    if (!cliente.auth_user_id) return { error: new Error('El cliente no tiene un ID de autenticación vinculado.') }

    const { data, error } = await supabase.rpc('rpc_aprobar_usuario', {
      p_user_id: cliente.auth_user_id,
      p_status: newStatus,
      p_motivo: motivo
    })

    if (error) return { error }
    if (data && !data.success) return { error: new Error(data.message) }

    setClientes(prev => prev.map(c => 
      c.id === cliente.id ? { ...c, estado: newStatus, motivo_estado: motivo } : c
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

  async function resetUserPassword(authUserId, newPassword) {
    const { data, error } = await supabase.rpc('admin_reset_password_rpc', {
      p_user_id: authUserId,
      p_new_password: newPassword
    })
    return { data, error }
  }

  async function deleteClienteDefinitivo(authUserId) {
    const { data, error } = await supabase.rpc('delete_user_definitivo', {
      p_auth_user_id: authUserId
    })
    if (!error && data?.success) {
      setClientes(prev => prev.filter(c => c.auth_user_id !== authUserId))
    }
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
    updateRolesAdicionales,
    ajustarSaldoWallet,
    ajustarSaldoWalletBs,
    resetUserPassword,
    deleteClienteDefinitivo,
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

// HOOK: Billetera (ELIMINADO - Ahora en WalletContext.jsx)
// ========================

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
  async function enviarNotificacion(notificacion, duracionMinutos = 60) {
    const expira_at = new Date(Date.now() + duracionMinutos * 60 * 1000).toISOString()
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

// ========================
// HOOK: Cuentas Guardadas
// ========================
export function useCuentasGuardadas(juegoId) {
  const { user } = useAuth()
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchCuentas() {
    if (!user || !juegoId) {
      setCuentas([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('cuentas_guardadas')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('juego_id', juegoId)
      .order('created_at', { ascending: false })
    
    if (data) setCuentas(data)
    setLoading(false)
  }

  async function guardarCuenta(cuentaData) {
    if (!user || !juegoId) return { error: 'Sesión no iniciada o juego no seleccionado' }
    
    // Limpiar campos para evitar undefined
    const cleanData = {
      player_id: cuentaData.player_id || null,
      zone_id: cuentaData.zone_id || null,
      email: cuentaData.email || null,
      password: cuentaData.password || null,
      username: cuentaData.username || null,
      nombre_perfil: cuentaData.nombre_perfil || 'Cuenta Guardada',
      tipo_dato: cuentaData.tipo_dato || 'id'
    }

    // Verificar si ya existe una cuenta idéntica para evitar duplicados
    let query = supabase
      .from('cuentas_guardadas')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('juego_id', juegoId)
    
    if (cleanData.player_id) query = query.eq('player_id', cleanData.player_id)
    else query = query.is('player_id', null)

    if (cleanData.zone_id) query = query.eq('zone_id', cleanData.zone_id)
    else query = query.is('zone_id', null)

    if (cleanData.email) query = query.eq('email', cleanData.email)
    else query = query.is('email', null)

    if (cleanData.username) query = query.eq('username', cleanData.username)
    else query = query.is('username', null)

    const { data: existente, error: errorCheck } = await query.maybeSingle()

    if (errorCheck) console.error('Error verificando duplicado:', errorCheck)
    if (existente) return { data: existente, error: null }

    const { data, error } = await supabase
      .from('cuentas_guardadas')
      .insert([{ ...cleanData, auth_user_id: user.id, juego_id: juegoId }])
      .select()
      .single()
    
    if (error) {
      console.error('Error al guardar cuenta:', error)
    } else if (data) {
      setCuentas(prev => [data, ...prev])
    }
    return { data, error }
  }

  async function eliminarCuenta(id) {
    const { error } = await supabase
      .from('cuentas_guardadas')
      .delete()
      .eq('id', id)
    
    if (!error) setCuentas(prev => prev.filter(c => c.id !== id))
    return { error }
  }

  useEffect(() => {
    fetchCuentas()
  }, [user?.id, juegoId])

  return { cuentas, loading, guardarCuenta, eliminarCuenta, refetch: fetchCuentas }
}

// ========================
// HOOK: Baúl de Códigos
// ========================
export function useProductoCodigos(productoId) {
  const [codigos, setCodigos] = useState([])
  const [loading, setLoading] = useState(true)
  const { perfil, user } = useAuth()
  const isNegocio = perfil?.rol === 'negocio'

  async function fetchCodigos() {
    if (!productoId) { setCodigos([]); setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('producto_codigos')
      .select('*, pedidos(numero_pedido)')
      .eq('producto_id', productoId)
      .order('created_at', { ascending: false })

    if (isNegocio) {
      query = query.eq('owner_id', user.id)
    } else {
      query = query.is('owner_id', null)
    }

    const { data, error } = await query
    if (data) setCodigos(data)
    setLoading(false)
  }

  async function addCodigos(codigosList) {
    if (!productoId) return { error: 'No product selected' }
    
    const payload = codigosList.map(c => ({
      producto_id: productoId,
      codigo: c.trim(),
      owner_id: isNegocio ? user.id : null
    })).filter(c => c.codigo.length > 0)

    if (payload.length === 0) return { error: 'No codes to add' }

    const { data, error } = await supabase.from('producto_codigos').insert(payload).select()
    if (!error && data) {
      setCodigos(prev => [...data, ...prev])
    }
    return { data, error }
  }

  async function deleteCodigo(id) {
    const { error } = await supabase.from('producto_codigos').delete().eq('id', id).eq('usado', false)
    if (!error) {
      setCodigos(prev => prev.filter(c => c.id !== id))
    }
    return { error }
  }

  async function deleteCodigoUsado(id) {
    const { error } = await supabase.from('producto_codigos').delete().eq('id', id).eq('usado', true)
    if (!error) {
      setCodigos(prev => prev.filter(c => c.id !== id))
    }
    return { error }
  }

  async function reorderCodigos(newOrder) {
    // newOrder: array of { id, orden } for available codes only
    const updates = newOrder.map((item, idx) => ({ id: item.id, orden: idx + 1 }))
    // Optimistic update
    setCodigos(prev => {
      const map = new Map(updates.map(u => [u.id, u.orden]))
      return prev.map(c => map.has(c.id) ? { ...c, orden: map.get(c.id) } : c)
    })
    const { error } = await supabase.rpc('actualizar_orden_codigos_rpc', { p_updates: updates })
    if (error) {
      console.error('Error updating order:', error)
      // Revert on error
      fetchCodigos()
    }
    return { error }
  }

  useEffect(() => {
    fetchCodigos()
  }, [productoId])

  return { codigos, loading, addCodigos, deleteCodigo, deleteCodigoUsado, reorderCodigos, refetch: fetchCodigos }
}

export { useClientes as useUsuarios }
