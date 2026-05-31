import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../utils/imageCompression'
import { useAuth, useConfiguracion } from '../hooks/useData'
import AlertModal from './AlertModal'
import { playSuccessSound, playCashRegisterSound, playErrorSound, formatBs, formatUSD, getOptimizedImageUrl } from '../utils/helpers'
import { processAutoDeliveryOrder } from '../utils/autoProcess'

const DEFAULT_CANCEL_MESSAGE = (num) => `Tu Pedido #${num} se ha cancelado motivado a que la referencia de pago que colocaste no ha podido ser encontrado en nuestro banco, es decir, el pago no pudo ser verificado y esto se debe a alguno de los siguientes motivos:

-Colocaste mal el número de referencia de tu pago.

-Estás colocando una referencia de un pago que no existe o que no se realizó correctamente.


Por favor verifica en tu banco el número de referencia, o comunícate con tu banco para consultar sobre el estado de ese pago que a nuestra cuenta no llegó.


Verifica estos motivos y vuelve a crear un nuevo pedido: Recuerda que si creas muchos pedidos con referencias de pagos que no existan, tu usuario podría ser expulsado por colocar referencias de pagos falsos.`;

export default function Pedidos({ filterKey, params, onNavigate, embedded = false }) {
  const normalizedParams = typeof params === 'object' && params !== null ? params : { filterKey: params };
  const incomingFilterKey = normalizedParams.filterKey || filterKey;
  const targetOrderId = normalizedParams.orderId;
  const targetOrderNumber = normalizedParams.orderNumber; // Para navegación desde chat
  const { user, perfil, isCliente } = useAuth()
  const { config } = useConfiguracion()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'administrador'
  const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'
  const isEmpleado = perfil?.rol?.toLowerCase() === 'empleado' || perfil?.rol?.toLowerCase() === 'trabajador'
  
  const maskSensitive = (val, type = 'text') => {
    if (!isEmpleado) return val;
    if (!val) return '***';
    if (type === 'email') {
      const [u, d] = val.split('@');
      return `${u.charAt(0)}***@${d}`;
    }
    if (type === 'phone') {
      return val.substring(0, 4) + '***' + val.substring(val.length - 2);
    }
    return val.split(' ')[0] + ' ***';
  }
  const isSuperAdmin = user?.email?.toLowerCase() === 'ceriraga@gmail.com'

  const esElOperador = (pedido) => {
    if (!pedido || !pedido.atendido_por_id) return false;
    const uid = String(user?.id).toLowerCase();
    const pid = String(perfil?.cliente_uuid).toLowerCase();
    const pid_perfil = String(perfil?.id).toLowerCase();
    const aid = String(pedido.atendido_por_id).toLowerCase();
    return aid === uid || aid === pid || aid === pid_perfil;
  };

  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [stockCounts, setStockCounts] = useState({})
  const [filtroEstado, setFiltroEstado] = useState(incomingFilterKey === 'ordenes_pendientes' ? 'pendiente' : (incomingFilterKey || 'todos'))
  const [uploading, setUploading] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [modalClient, setModalClient] = useState(null)
  const [alertModal, setAlertModal] = useState(null) // { title, message, type, onConfirm }
  
  const [rechazandoItem, setRechazandoItem] = useState(null) // ID del item si se está rechazando
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [cancelacionMensaje, setCancelacionMensaje] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  // Super Admin: asignación y atribución de pedidos
  const [showAsignarAdminModal, setShowAsignarAdminModal] = useState(false)
  const [showAtribuirModal, setShowAtribuirModal] = useState(false)
  const [adminsList, setAdminsList] = useState([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [adminSeleccionado, setAdminSeleccionado] = useState(null)


  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  async function fetchPedidos() {
    setLoading(true)
    let query = supabase
      .from('pedidos')
      .select('*, pedido_items(*, productos(*))')
      .order('created_at', { ascending: false })

    if (normalizedParams.userId) {
      // Si se pasa un userId específico, filtramos solo por ese usuario
      query = query.eq('cliente_id', normalizedParams.userId)
    } else if (!isSuperAdmin) {
      const ownerId = perfil?.owner_id || (isNegocio ? user?.id : null)
      if (ownerId) {
        // Si es un negocio o admin de negocio, ve lo de su negocio o lo que él mismo pidió
        query = query.or(`owner_id.eq.${ownerId},cliente_id.eq.${user.id}`)
      } else if (!isAdmin) {
        // Si es cliente raso, solo ve lo suyo
        query = query.eq('cliente_id', user.id)
      }
    }

    const { data: rawPedidos, error } = await query

    if (error) {
      console.error("Error fetching pedidos:", error);
      showAlert("Error al cargar pedidos: " + error.message, 'error');
      setLoading(false);
      return;
    }

    if (rawPedidos && rawPedidos.length > 0) {
      // 1. Obtener los perfiles de los usuarios que han creado órdenes (sin lista UUID para evitar Error 414 URI Too Long) 
      const { data: usersData, error: usersError } = await supabase
        .from('clientes')
        .select('id, auth_user_id, nombres, apellidos, nickname, whatsapp, usuario, fecha_registro')

      if (usersError) console.error("Error fetching names:", usersError)

      // 3. Crear mapas para búsqueda rápida (indexamos por auth_user_id e id interno de clientes)
      const userMap = new Map();
      (usersData || []).forEach(u => {
        if (u.auth_user_id) userMap.set(u.auth_user_id, u);
        if (u.id) userMap.set(u.id, u);
      });

      const getClienteFallback = (id) => {
        let c = userMap.get(id);
        if (!c && user && id === user.id) {
          c = {
            auth_user_id: user.id,
            nombres: user.user_metadata?.nombres || 'Tú (Admin Antiguo)',
            apellidos: user.user_metadata?.apellidos || '',
            usuario: user.email,
            nickname: user.user_metadata?.nickname || 'Admin',
            whatsapp: user.user_metadata?.whatsapp || 'No especificado'
          };
        }
        return c;
      };

      // 4. Integrar datos en el array de pedidos
      const finalPedidos = rawPedidos.map(p => ({
        ...p,
        cliente: getClienteFallback(p.cliente_id),
        atendido_por: getClienteFallback(p.atendido_por_id)
      }))

      setPedidos(finalPedidos)
    } else {
      setPedidos([])
    }
    setLoading(false)
  }

  useEffect(() => {
    // Esperar a que la autenticación esté lista antes de consultar pedidos
    if (perfil) {
      fetchPedidos()
    }
  }, [user, perfil])

  useEffect(() => {
    if (incomingFilterKey) {
      setFiltroEstado(incomingFilterKey === 'ordenes_pendientes' ? 'pendiente' : incomingFilterKey)
      setCurrentPage(1) // Reset página al cambiar filtro desde Layout
      setSelectedPedido(null) // Regresar a la lista al cambiar de sección
    }
  }, [incomingFilterKey])
  // Efecto para buscar el stock de los items de entrega automática
  useEffect(() => {
    if (selectedPedido && selectedPedido.pedido_items) {
      const fetchStock = async () => {
        const counts = { ...stockCounts };
        let updated = false;
        for (const item of selectedPedido.pedido_items) {
          const prod = item.productos || item.producto || (Array.isArray(item.productos) ? item.productos[0] : null);
          if (prod?.entrega_automatica && !item.codigo_entregado && counts[prod.id] === undefined) {
            const { count, error } = await supabase
              .from('producto_codigos')
              .select('*', { count: 'exact', head: true })
              .eq('producto_id', prod.id)
              .eq('usado', false);
            if (error) {
               console.error('Error fetching stock for product', prod.id, error);
               counts[prod.id] = 0;
            } else {
               console.log(`Stock for product ${prod.id}: ${count}`);
               counts[prod.id] = count || 0;
            }
            updated = true;
          }
        }
        if (updated) setStockCounts(counts);
      };
      fetchStock();
    }
  }, [selectedPedido]);

  useEffect(() => {
    // Escuchar cambios en el ID de pedido (ej. desde notificaciones)
    if (targetOrderId || targetOrderNumber) {
      const findAndOpen = () => {
        if (targetOrderId) {
          const order = pedidos.find(p => p.id === targetOrderId);
          if (order) {
            setSelectedPedido(order);
            return true;
          }
        } else if (targetOrderNumber) {
          const cleanNum = targetOrderNumber.replace('#', '').trim();
          const order = pedidos.find(p => String(p.numero_pedido).padStart(6, '0') === cleanNum || String(p.numero_pedido) === cleanNum);
          if (order) {
            setSelectedPedido(order);
            return true;
          }
        }
        return false;
      };

      if (pedidos.length > 0) {
        const found = findAndOpen();
        // Si no lo encuentra, tal vez es un pedido muy nuevo, refrescamos
        if (!found) fetchPedidos();
      }
    }
  }, [targetOrderId, targetOrderNumber, pedidos.length]);

  // Suscripción Realtime para la lista de pedidos
  useEffect(() => {
    const channel = supabase
      .channel('admin_pedidos_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  useEffect(() => {
    if (selectedPedido) {
      // Garantizar que el mensaje predeterminado use el número de pedido actual
      setCancelacionMensaje(DEFAULT_CANCEL_MESSAGE(selectedPedido.numero_pedido || ''))
    }
  }, [selectedPedido?.id])

  // Escuchar reset desde Sidebar
  useEffect(() => {
    const handleReset = () => {
      console.log("♻️ Reseteando vista de pedidos desde navegación lateral");
      setSelectedPedido(null);
      setFiltroEstado('todos');
      setCurrentPage(1);
    };
    window.addEventListener('reset-pedidos', handleReset);
    return () => window.removeEventListener('reset-pedidos', handleReset);
  }, []);

  // Cargar datos del cliente bajo demanda al abrir un pedido
  useEffect(() => {
    async function fetchClientData() {
      if (selectedPedido && selectedPedido.cliente_id && !selectedPedido.cliente) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, auth_user_id, nombres, apellidos, nickname, whatsapp, usuario, fecha_registro')
          .or(`id.eq.${selectedPedido.cliente_id},auth_user_id.eq.${selectedPedido.cliente_id}`)
          .maybeSingle();

        if (data && !error) {
          setSelectedPedido(prev => {
            if (prev?.id === selectedPedido.id) {
              return { ...prev, cliente: data };
            }
            return prev;
          });
        } else {
          // Prevent infinite loading state if client not found
          setSelectedPedido(prev => {
            if (prev?.id === selectedPedido.id) {
              const isAdminFallback = user && selectedPedido.cliente_id === user.id;

              return {
                ...prev,
                cliente: isAdminFallback ? {
                  auth_user_id: user.id,
                  nombres: user.user_metadata?.nombres || 'Tú (Administrador)',
                  apellidos: user.user_metadata?.apellidos || '',
                  usuario: user.email,
                  nickname: user.user_metadata?.nickname || 'Admin',
                  whatsapp: user.user_metadata?.whatsapp || 'No especificado'
                } : {
                  nombres: 'Usuario antiguo (Sin Enlace)',
                  apellidos: '',
                  auth_user_id: selectedPedido.cliente_id,
                  usuario: 'Desconocido'
                }
              };
            }
            return prev;
          });
        }
      }
    }
    fetchClientData();
  }, [selectedPedido?.id, selectedPedido?.cliente_id, selectedPedido?.cliente]);

  const handleOpenPedido = async (pedido) => {
    setSelectedPedido(pedido);
  }

  const formatFecha = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  const formatUSD = (n) => `$${Number(n || 0).toFixed(2)}`

  const getEstadoStyle = (estado) => {
    switch (estado) {
      case 'completado':
        return { label: 'Pedido Completado', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: '✅' }
      case 'pendiente':
        return { bg: 'rgba(255, 171, 0, 0.15)', color: '#ffab00', label: '⏳ Pendiente' }
      case 'cancelado': return { bg: 'rgba(255, 82, 82, 0.15)', color: '#ff5252', label: '❌ Cancelado' }
      case 'pago_no_encontrado':
        return { label: 'Pago No Encontrado', color: '#ce93d8', bg: 'rgba(206, 147, 216, 0.15)', icon: '🔍' }
      case 'pago_duplicado':
        return { label: 'Pago Duplicado', color: '#ffb74d', bg: 'rgba(255, 183, 77, 0.15)', icon: '⚠️' }
      case 'reembolsado':
        return { label: '🔄 Reembolsado a Billetera', color: '#e040fb', bg: 'rgba(224, 64, 251, 0.15)', icon: '💸' }
      default: return { bg: 'rgba(255, 171, 0, 0.15)', color: '#ffab00', label: estado }
    }
  }

  const FILTROS = [
    { key: 'todos', label: 'Todos', icon: '📋' },
    { key: 'pagos_pendientes', label: 'Pagos por Verificar', icon: '💳' },
    { key: 'recargas_pendientes', label: 'Recargas Pendientes', icon: '⚡' },
    { key: 'pendiente', label: 'Órdenes Pendientes', icon: '⏳' },
    { key: 'completado', label: 'Completados', icon: '✅' },
    { key: 'pago_no_encontrado', label: 'Pago No Encontrado', icon: '🔍' },
    { key: 'pago_duplicado', label: 'Pago Duplicado', icon: '⚠️' },
    { key: 'cancelado', label: 'Cancelados', icon: '❌' },
  ]

  const filterPedidos = (list, key) => {
    if (!key || key === 'todos') return list
    if (key === 'pagos_pendientes') {
      return list.filter(p => p.pago_verificado === null && !['completado', 'cancelado', 'reembolsado'].includes(p.estado))
    }
    if (key === 'recargas_pendientes') {
      return list.filter(p => p.pago_verificado === true && !['completado', 'cancelado', 'reembolsado'].includes(p.estado))
    }
    return list.filter(p => p.estado === key)
  }

  let pedidosFiltrados = filterPedidos(pedidos, filtroEstado)

  if (busqueda.trim() !== '') {
    const q = busqueda.toLowerCase()
    pedidosFiltrados = pedidosFiltrados.filter(p => {
      const matchPedido = String(p.numero_pedido).toLowerCase().includes(q)
      const matchCliente = String(p.cliente?.usuario || '').toLowerCase().includes(q) || String(p.cliente?.whatsapp || '').toLowerCase().includes(q)
      const matchRef = String(p.referencia_pago || '').toLowerCase().includes(q)
      const matchItems = (p.pedido_items || []).some(item => 
        String(item.player_id || '').toLowerCase().includes(q) ||
        String(item.account_email || '').toLowerCase().includes(q) ||
        String(item.account_password || '').toLowerCase().includes(q) ||
        String(item.datos_extra || '').toLowerCase().includes(q)
      )
      return matchPedido || matchCliente || matchRef || matchItems
    })
  }

  // Cálculos de Paginación
  const totalPages = Math.ceil(pedidosFiltrados.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPedidos = pedidosFiltrados.slice(startIndex, startIndex + itemsPerPage)

  const updateEstado = async (pedidoId, nuevoEstado) => {
    // 1. Obtener el pedido actual con manejo de errores
    const { data: pedidoActual, error: fetchError } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*, productos(*))')
      .eq('id', pedidoId)
      .maybeSingle()

    if (fetchError || !pedidoActual) {
      console.error("❌ Error al obtener detalles del pedido:", fetchError);
      showAlert("No se pudieron obtener los detalles del pedido para completar la operación. " + (fetchError?.message || ''), 'error');
      return;
    }

    const updateData = { estado: nuevoEstado, updated_at: new Date().toISOString() }

    // Si se completa, registrar quién lo hizo como responsable
    if (nuevoEstado === 'completado') {
      updateData.atendido_por_id = user.id
    }

    // Registrar fecha_respuesta cuando se cambia de pendiente a cualquier otro estado
    if (nuevoEstado !== 'pendiente') {
      updateData.fecha_respuesta = new Date().toISOString()
    } else {
      updateData.fecha_respuesta = null
    }

    // 2. Si el nuevo estado es COMPLETADO y no se ha registrado la venta aún, registrarla
    if (nuevoEstado === 'completado' && !pedidoActual.venta_registrada) {
      try {
        console.log(`📦 Registrando ventas para pedido #${pedidoActual.numero_pedido}...`)
        for (const item of (pedidoActual.pedido_items || [])) {
          console.log(`🔹 Item: ${item.productos?.nombre || 'Producto'} | Vendedor: ${perfil?.cliente_uuid || 'NULL!'}`)
          const { data, error: rpcError } = await supabase.rpc('registrar_venta_rpc', {
            p_producto_id: item.producto_id,
            p_cantidad: item.cantidad,
            p_notas: `Pedido #${pedidoActual.numero_pedido}`,
            p_cliente_id: pedidoActual.cliente_id,
            p_metodo_pago_id: pedidoActual.metodo_pago_id,
            p_referencia_pago: pedidoActual.referencia_pago,
            p_player_id: item.player_id,
            p_account_email: item.account_email,
            p_account_password: item.account_password,
            p_vendedor_id: perfil?.cliente_uuid,
            p_pedido_id: null,
            p_owner_id: perfil?.owner_id // Agregado para aislamiento de negocios
          })
          if (rpcError) {
            console.error('❌ Error RPC registrando venta:', rpcError)
            throw new Error(rpcError.message || 'Error desconocido en el servidor de ventas')
          }
          if (data?.error) {
            console.error('❌ Error lógico en venta:', data.error)
            throw new Error(data.error)
          }
          console.log('✅ Venta registrada:', data?.id)

          // 2.1 Entrega Automática de Código (Baúl)
          if (item.productos?.entrega_automatica) {
            console.log(`🎁 Asignando código del baúl para item ${item.id}...`)
            const { data: codeData, error: codeError } = await supabase.rpc('asignar_codigo_pedido_item_rpc', {
              p_pedido_item_id: item.id
            })
            if (codeError) console.error('❌ Error al asignar código:', codeError)
            else if (codeData) console.log('✅ Código asignado:', codeData)
            else console.warn('⚠️ No hay códigos disponibles en el baúl para este producto.')
          }
        }
        console.log('🏁 Registro de ventas completado.')
        updateData.venta_registrada = true
      } catch (err) {
        console.error('Error al registrar venta:', err)
        showAlert('No se pudo completar el pedido porque falló el registro contable: ' + err.message, 'error')
        return // No procedemos con el update del estado si falló el registro de venta
      }

      // 3. Sistema de Cash Back
      if (config?.cashback_activo === 'true' && Number(config?.cashback_porcentaje) > 0 && !pedidoActual.cashback_aplicado) {
        try {
          const p = Number(config.cashback_porcentaje)
          if (p > 0) {
            const ref = (pedidoActual.referencia_pago || '').toLowerCase()
            let isBs = ref.includes('billetera bs') || ref.includes('pago móvil') || ref.includes('pago movil') || ref.includes('bolívares') || ref.includes('bs')
            
            if (!isBs && pedidoActual.metodo_pago_id) {
               const { data: mData } = await supabase.from('metodos_pago').select('nombre, habilitado_billetera_bs').eq('id', pedidoActual.metodo_pago_id).maybeSingle()
               if (mData && (
                   mData.habilitado_billetera_bs || 
                   mData.nombre.toLowerCase().includes('pago') || 
                   mData.nombre.toLowerCase().includes('bs') || 
                   mData.nombre.toLowerCase().includes('bolívares')
               )) {
                   isBs = true
               }
            }

            const { data: walletData } = await supabase.from('billeteras').select('*').eq('auth_user_id', pedidoActual.cliente_id).maybeSingle()
            const baseUsd = walletData?.saldo || 0
            const baseBs = walletData?.saldo_bs || 0

            if (isBs) {
               const returnBs = Number(pedidoActual.total_bs) * (p / 100)
               if (returnBs > 0) {
                 await supabase.rpc('ajustar_saldo_billetera_bs_rpc', {
                   p_user_id: pedidoActual.cliente_id,
                   p_admin_id: user.id,
                   p_nuevo_saldo: baseBs + returnBs,
                   p_nota: `💸 Cash Back (${p}%) por Pedido #${pedidoActual.numero_pedido}`
                 })
                 updateData.cashback_monto = returnBs
                 updateData.cashback_moneda = 'bs'
               }
            } else {
               const returnUsd = Number(pedidoActual.total_usd) * (p / 100)
               if (returnUsd > 0) {
                 await supabase.rpc('ajustar_saldo_billetera_rpc', {
                   p_user_id: pedidoActual.cliente_id,
                   p_admin_id: user.id,
                   p_nuevo_saldo: baseUsd + returnUsd,
                   p_nota: `💸 Cash Back (${p}%) por Pedido #${pedidoActual.numero_pedido}`
                 })
                 updateData.cashback_monto = returnUsd
                 updateData.cashback_moneda = 'usd'
               }
            }
            updateData.cashback_aplicado = true
            updateData.cashback_porcentaje = p
          }
        } catch (cbError) {
          console.error("Error aplicando cashback:", cbError)
        }
      }
    }

    const { error } = await supabase
      .from('pedidos')
      .update(updateData)
      .eq('id', pedidoId)

    if (!error) {
      if (nuevoEstado === 'completado') {
        playSuccessSound()
      }
      setPedidos(pedidos.map(p => p.id === pedidoId ? { ...p, ...updateData } : p))
      if (selectedPedido?.id === pedidoId) {
        setSelectedPedido({ ...selectedPedido, ...updateData })
      }

      // 🔔 La notificación para el cliente se maneja automáticamente vía Trigger (093_order_notifications_trigger.sql)
    } else {
      showAlert('Error al actualizar el pedido: ' + error.message, 'error')
      return
    }

    // Re-fetch or update selectedPedido if it's the one being viewed
    if (selectedPedido?.id === pedidoId) {
      const { data: updatedPedido } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*, productos(*))')
        .eq('id', pedidoId)
        .single()
      if (updatedPedido) {
        setSelectedPedido({ ...updatedPedido, cliente: selectedPedido.cliente, atendido_por: selectedPedido.atendido_por })
      }
    }
  }

  const handleReembolso = async (pedido) => {
    // Primero mostrar selector de moneda
    showAlert(
      `¿A cuál billetera deseas reembolsar este pedido?\n\n💵 USD: $${Number(pedido.total_usd).toFixed(2)}\n🏦 Bs: Bs ${Number(pedido.total_bs).toLocaleString('es-VE')}`,
      'confirm',
      async () => {
        // Default: reembolsar en USD. Preguntamos si quiere Bs.
        showAlert(
          `Selecciona la billetera de destino para el reembolso:`,
          'confirm',
          // Botón Confirmar = USD
          async () => {
            await ejecutarReembolso(pedido, 'usd');
          },
          // Custom: usamos onCancel para Bs option - we'll handle differently
        );
      }
    );
  }

  const [showReembolsoModal, setShowReembolsoModal] = useState(false);
  const [reembolsoPedido, setReembolsoPedido] = useState(null);
  const [reembolsoMonto, setReembolsoMonto] = useState('');
  const [reembolsoMoneda, setReembolsoMoneda] = useState('bs');
  const [reembolsoCambiarEstado, setReembolsoCambiarEstado] = useState(true);

  const handleReembolsoSelect = (pedido) => {
    setReembolsoPedido(pedido);
    // Pre-llenar con el total y verificar si se usó billetera por referencia
    const isBsUsed = pedido.referencia_pago?.toLowerCase().includes('billetera bs');
    const isUsUsed = pedido.referencia_pago?.toLowerCase().includes('billetera usd');
    
    setReembolsoMoneda(isUsUsed ? 'usd' : 'bs');
    
    // Intentar extraer el monto parcial si existe en la referencia
    let prefillMonto = null;
    if (isBsUsed || isUsUsed) {
      const match = pedido.referencia_pago.match(/billetera\s+(bs|usd):\s*([0-9.,]+)/i);
      if (match && match[2]) {
        prefillMonto = match[2].replace(/\./g, '').replace(/,/g, '.'); // Convertir "1.500" o "15,50" a numero
      }
    }
    
    setReembolsoMonto(prefillMonto || (isUsUsed ? pedido.total_usd : pedido.total_bs));
    setReembolsoCambiarEstado(true);
    setShowReembolsoModal(true);
  }

  const ejecutarReembolso = async (pedido, moneda, monto, cambiarEstado) => {
    if (!monto || isNaN(monto) || Number(monto) <= 0) {
      showAlert("Por favor ingresa un monto válido a reembolsar.", "error");
      return;
    }
    
    setShowReembolsoModal(false);
    setLoading(true);
    const { data, error } = await supabase.rpc('reembolsar_pedido_rpc', {
      p_pedido_id: pedido.id,
      p_admin_id: user.id,
      p_notas: `Reembolso administrativo ${cambiarEstado ? 'y cancelación' : 'parcial'} por pedido #${pedido.numero_pedido} (${moneda === 'bs' ? 'Bolívares' : 'USD'})`,
      p_moneda: moneda,
      p_monto: Number(monto),
      p_cambiar_estado: cambiarEstado
    });

    if (error) {
      console.error("Error en reembolso:", error);
      showAlert("Error al procesar el reembolso: " + error.message, 'error');
    } else if (data?.error) {
      showAlert(data.error, 'error');
    } else {
      playCashRegisterSound();
      const monedaLabel = moneda === 'bs' ? formatBs(monto) : `$${Number(monto).toFixed(2)}`;
      showAlert(`✅ Reembolso exitoso. ${monedaLabel} acreditados a la billetera ${moneda === 'bs' ? 'Bolívares' : 'USD'} del cliente.`, 'success');
      
      const updateData = cambiarEstado 
        ? { estado: 'reembolsado', reembolso_billetera: true, updated_at: new Date().toISOString() }
        : { reembolso_billetera: true, updated_at: new Date().toISOString() };
      
      setPedidos(prev => prev.map(p => {
        if (p.id === pedido.id) {
          const updatedPedido = { ...p, ...updateData };
          if (cambiarEstado && updatedPedido.pedido_items) {
            updatedPedido.pedido_items = updatedPedido.pedido_items.map(item => ({
              ...item,
              codigo_entregado: null
            }));
          }
          return updatedPedido;
        }
        return p;
      }));
      
      setSelectedPedido(prev => {
        const updatedPedido = { ...prev, ...updateData };
        if (cambiarEstado && updatedPedido.pedido_items) {
          updatedPedido.pedido_items = updatedPedido.pedido_items.map(item => ({
            ...item,
            codigo_entregado: null
          }));
        }
        return updatedPedido;
      });
    }
    setLoading(false);
  }

  const renderReembolsoModal = () => {
    if (!showReembolsoModal || !reembolsoPedido) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, animation: 'fadeIn 0.3s ease'
      }} onClick={() => setShowReembolsoModal(false)}>
        <div style={{
          backgroundColor: '#1a1d21', width: '100%', maxWidth: '420px', borderRadius: '24px',
          padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(to right, #e040fb, #8b5cf6)' }}></div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💸</div>
            <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '4px' }}>Reembolso de Billetera</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Pedido #{reembolsoPedido.numero_pedido} | Ref: {reembolsoPedido.referencia_pago}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Moneda a reembolsar:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setReembolsoMoneda('usd')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', border: `2px solid ${reembolsoMoneda === 'usd' ? 'rgba(0, 210, 255, 0.8)' : 'rgba(255,255,255,0.1)'}`,
                    backgroundColor: reembolsoMoneda === 'usd' ? 'rgba(0, 210, 255, 0.1)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                  }}
                >💵 USD</button>
                <button
                  onClick={() => setReembolsoMoneda('bs')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', border: `2px solid ${reembolsoMoneda === 'bs' ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                    backgroundColor: reembolsoMoneda === 'bs' ? 'rgba(139, 92, 246, 0.1)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                  }}
                >🏦 Bs</button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Monto a acreditar ({reembolsoMoneda.toUpperCase()}):</label>
              <input 
                type="number" 
                step="0.01"
                value={reembolsoMonto}
                onChange={e => setReembolsoMonto(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '16px', outline: 'none' }}
                placeholder="Ej. 1500"
              />
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={reembolsoCambiarEstado}
                onChange={e => setReembolsoCambiarEstado(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '13px', color: '#fff' }}>Marcar el pedido como <span style={{ color: '#e040fb', fontWeight: 700 }}>REEMBOLSADO</span> al cliente. <br/><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Desmárcalo si solo quieres devolver saldo pero mantener el pedido como Fallido)</span></span>
            </label>

            <button 
              onClick={() => ejecutarReembolso(reembolsoPedido, reembolsoMoneda, reembolsoMonto, reembolsoCambiarEstado)}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#e040fb', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', marginTop: '8px'
              }}
            >
              Confirmar Reembolso
            </button>
            <button onClick={() => setShowReembolsoModal(false)} style={{
              width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 600, cursor: 'pointer'
            }}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  const handleVerificarPago = async (pedido, esValido) => {
    if (esValido) {
      const { data, error } = await supabase
        .from('pedidos')
        .update({ pago_verificado: true, updated_at: new Date().toISOString() })
        .eq('id', pedido.id)
        .select('*, pedido_items(*, productos(*))')
        .single();

      if (error) {
        console.error("Error validando pago:", error);
        showAlert("Error al verificar el pago: " + error.message, 'error');
        return;
      }

      if (data) {
        const pedFinal = { ...data, cliente: pedido.cliente, atendido_por: pedido.atendido_por }
        setSelectedPedido(pedFinal);
        setPedidos(prev => prev.map(p => p.id === data.id ? pedFinal : p));
        playCashRegisterSound();

        // Intentar autoprocesamiento en background si hay códigos
        processAutoDeliveryOrder(data.id).then(processed => {
          if (processed) {
            console.log('Pedido auto-procesado tras verificación manual');
            // Fetch nuevamente para actualizar la UI (el estado cambió a completado en DB)
            supabase.from('pedidos').select('*, pedido_items(*, productos(*))').eq('id', data.id).single()
              .then(({data: updData}) => {
                if(updData) {
                  const finalPed = { ...updData, cliente: pedido.cliente, atendido_por: pedido.atendido_por };
                  setSelectedPedido(prev => prev?.id === data.id ? finalPed : prev);
                  setPedidos(prev => prev.map(p => p.id === data.id ? finalPed : p));
                }
              });
          }
        }).catch(console.error);
      }
    } else {
      // Si se rechaza el pago
      await updatePedidoField(pedido.id, 'pago_verificado', false);
      playErrorSound();
    }
  }

  const handleTomarPedido = async (pedido) => {
    // Si ya tiene dueño, no hacer nada (seguridad extra)
    if (pedido.atendido_por_id) return;

    // Verificar en el estado LOCAL si ya tengo un pedido activo
    const activosMios = pedidos.filter(p =>
      p.atendido_por_id === user.id &&
      p.estado === 'procesando' &&
      p.id !== pedido.id
    );

    if (activosMios.length > 0) {
      const activo = activosMios[0];
      showAlert(
        `¡Atención! No puedes tomar otro pedido porque aún tienes pendiente procesar el pedido #${activo.numero_pedido}. Complétalo o libéralo primero.`,
        'warning',
        () => setSelectedPedido(activo)
      );
      return;
    }

    // Doble verificación: Consultar a la base de datos por si el estado local está desincronizado
    const { count, error: checkError } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('atendido_por_id', user.id)
      .eq('estado', 'procesando');

    if (!checkError && count > 0) {
      showAlert(
        `¡Atención! Ya tienes un pedido asignado en el servidor. Por favor, refresca la página o termina tu pedido actual.`,
        'warning'
      );
      return;
    }

    // RESTRICCIÓN: No permitir tomar pedido si el pago no está verificado
    if (pedido.pago_verificado !== true) {
      showAlert(
        "No puedes tomar este pedido porque el pago aún no ha sido verificado por administración.",
        'warning'
      );
      return;
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({
        atendido_por_id: user.id,
        estado: 'procesando',
        updated_at: new Date().toISOString()
      })
      .eq('id', pedido.id)
      .select('*, pedido_items(*, productos(*))')
      .single();

    if (error) {
      console.error("Error al tomar pedido:", error);
      showAlert("Error al tomar el pedido: " + error.message, 'error');
      return;
    }

    if (data) {
      const pedFinal = { ...data, cliente: pedido.cliente, atendido_por: pedido.atendido_por }
      setPedidos(prev => prev.map(p => p.id === data.id ? pedFinal : p));
      setSelectedPedido(pedFinal);
    }
  }

  const handleLiberarPedido = async (pedido) => {
    showAlert("¿Seguro que deseas liberar este pedido?", 'confirm', async () => {
      const { error } = await supabase
        .from('pedidos')
        .update({ atendido_por_id: null, estado: 'pendiente' })
        .eq('id', pedido.id);

      if (!error) {
        const pedActualizado = { ...pedido, atendido_por_id: null, estado: 'pendiente' };
        setPedidos(prev => prev.map(p => p.id === pedido.id ? pedActualizado : p));
        setSelectedPedido(pedActualizado);
      } else {
        showAlert("Error al liberar pedido: " + error.message, 'error');
      }
    });
  }

  // ────────────────────────────────────────────────────
  // SUPER ADMIN: Obtener lista de admins disponibles
  // ────────────────────────────────────────────────────
  const fetchAdmins = async () => {
    setLoadingAdmins(true)
    try {
      // El rol está en la tabla 'perfiles', no en 'clientes'
      const { data: perfilesData, error: perfilesError } = await supabase
        .from('perfiles')
        .select('id, rol')
        .in('rol', ['admin', 'administrador', 'empleado', 'trabajador'])
        .neq('id', user.id) // excluir al super admin mismo

      if (perfilesError) throw perfilesError

      const adminIds = (perfilesData || []).map(p => p.id)
      if (adminIds.length === 0) {
        setAdminsList([])
        return
      }

      // Ahora buscar los datos del perfil en 'clientes' por auth_user_id
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, auth_user_id, nombres, apellidos, nickname, usuario')
        .in('auth_user_id', adminIds)

      if (clientesError) throw clientesError
      setAdminsList(clientesData || [])
    } catch (e) {
      console.error('Error cargando admins:', e)
    } finally {
      setLoadingAdmins(false)
    }
  }

  const openAsignarAdminModal = () => {
    setAdminSeleccionado(null)
    fetchAdmins()
    setShowAsignarAdminModal(true)
  }

  const openAtribuirModal = () => {
    setAdminSeleccionado(null)
    fetchAdmins()
    setShowAtribuirModal(true)
  }

  // Asignar pedido a un admin para que lo procese
  const handleAsignarAdmin = async () => {
    if (!adminSeleccionado || !selectedPedido) return
    const { error } = await supabase
      .from('pedidos')
      .update({
        atendido_por_id: adminSeleccionado.auth_user_id,
        estado: 'procesando',
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedPedido.id)
    if (error) {
      showAlert('Error al asignar pedido: ' + error.message, 'error')
      return
    }
    const upd = { ...selectedPedido, atendido_por_id: adminSeleccionado.auth_user_id, atendido_por: adminSeleccionado, estado: 'procesando' }
    setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? upd : p))
    setSelectedPedido(upd)
    setShowAsignarAdminModal(false)

    showAlert(`✅ Pedido asignado a ${adminSeleccionado.nombres} ${adminSeleccionado.apellidos || ''} correctamente.`, 'success')
  }

  // Decretar que un pedido fue procesado por un admin específico
  // Llama a registrar_venta_rpc con el cliente_uuid del admin seleccionado
  const updateEstadoConAdmin = async (pedidoId, nuevoEstado, adminTarget) => {
    const { data: pedidoActual, error: fetchError } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*, productos(*))')
      .eq('id', pedidoId)
      .maybeSingle()

    if (fetchError || !pedidoActual) {
      showAlert('No se pudo obtener el pedido: ' + (fetchError?.message || ''), 'error')
      return
    }

    // adminTarget ya viene de fetchAdmins con 'id' y 'auth_user_id' desde la tabla clientes
    // adminTarget.id = el id de clientes = equivalente al cliente_uuid del perfil del admin
    // No necesitamos una segunda consulta a la DB
    const vendedorId = adminTarget.id   // ⭐ Crédito al admin seleccionado

    if (!vendedorId) {
      showAlert('El administrador seleccionado no tiene un perfil válido para acreditar el saldo.', 'error')
      return
    }

    const now = new Date().toISOString()
    const updateData = {
      estado: nuevoEstado,
      atendido_por_id: adminTarget.auth_user_id,
      fecha_respuesta: now,
      updated_at: now
    }

    if (nuevoEstado === 'completado' && !pedidoActual.venta_registrada) {
      try {
        for (const item of (pedidoActual.pedido_items || [])) {
          const { data, error: rpcError } = await supabase.rpc('registrar_venta_rpc', {
            p_producto_id: item.producto_id,
            p_cantidad: item.cantidad,
            p_notas: `Pedido #${pedidoActual.numero_pedido} (Atribuido a ${adminTarget.nombres || ''} por Super Admin)`,
            p_cliente_id: pedidoActual.cliente_id,
            p_metodo_pago_id: pedidoActual.metodo_pago_id,
            p_referencia_pago: pedidoActual.referencia_pago,
            p_player_id: item.player_id,
            p_account_email: item.account_email,
            p_account_password: item.account_password,
            p_vendedor_id: vendedorId,
            p_pedido_id: pedidoActual.id,
            p_owner_id: null  // Negocio principal
          })
          if (rpcError) throw new Error(rpcError.message)
          if (data?.error) throw new Error(data.error)

          if (item.productos?.entrega_automatica) {
            await supabase.rpc('asignar_codigo_pedido_item_rpc', { p_pedido_item_id: item.id })
          }
        }
        updateData.venta_registrada = true
      } catch (err) {
        showAlert('Error al registrar venta: ' + err.message, 'error')
        return
      }
    }

    const { error } = await supabase.from('pedidos').update(updateData).eq('id', pedidoId)
    if (error) {
      showAlert('Error al actualizar pedido: ' + error.message, 'error')
      return
    }
    playSuccessSound()
    const upd = { ...selectedPedido, ...updateData, atendido_por: adminTarget }
    setPedidos(prev => prev.map(p => p.id === pedidoId ? upd : p))
    setSelectedPedido(upd)
    setShowAtribuirModal(false)
    showAlert(`✅ Pedido marcado como COMPLETADO y acreditado a ${adminTarget.nombres || ''}.`, 'success')
  }

  // ────────────────────────────────────────────────────────────────────
  // SUPER ADMIN: Reversar un pedido COMPLETADO
  // Revierte la venta, descuenta el saldo del operario (permite negativo)
  // ────────────────────────────────────────────────────────────────────
  const handleReversarCompletado = async (pedido) => {
    showAlert(
      `¿Reversar el pedido #${pedido.numero_pedido}? Esto revertirá el estado a PROCESANDO y descontará el crédito del operario (puede quedar en saldo negativo si no tiene suficiente saldo).`,
      'confirm',
      async () => {
        try {
          // 1. Ya no hacemos la deducción manual porque el trigger en BD (trig_act_saldos_admin)
          // se encarga automáticamente de revertir el saldo al cambiar el estado del pedido
          // de 'completado' a 'procesando'.

          // 4. Eliminar las ventas de la tabla ventas
          await supabase.from('ventas').delete().eq('pedido_id', pedido.id)

          // 5. Revertir estado del pedido
          const { error: updateError } = await supabase
            .from('pedidos')
            .update({
              estado: 'procesando',
              venta_registrada: false,
              fecha_respuesta: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', pedido.id)

          if (updateError) throw new Error('Error al revertir el pedido: ' + updateError.message)

          const upd = { ...pedido, estado: 'procesando', venta_registrada: false, fecha_respuesta: null }
          setPedidos(prev => prev.map(p => p.id === pedido.id ? upd : p))
          setSelectedPedido(upd)
          showAlert(`✅ Pedido #${pedido.numero_pedido} reversado. El saldo del operario fue ajustado.`, 'success')

        } catch (err) {
          console.error('Error reversando pedido:', err)
          showAlert('Error al reversar: ' + err.message, 'error')
        }
      }
    )
  }

  // Descuenta el saldo operativo de un admin para UNA SOLA moneda
  // y registra el reverso en admin_saldos_historial (permite saldo negativo)
  const insertarReversoManual = async (adminAuthId, moneda, monto, pedido) => {
    try {
      const campoSaldo = moneda === 'usd' ? 'saldo_usd' : 'saldo_bs'

      // Leer saldo actual
      const { data: row } = await supabase
        .from('admin_saldos')
        .select(campoSaldo)
        .eq('auth_user_id', adminAuthId)
        .maybeSingle()

      const nuevoSaldo = (Number(row?.[campoSaldo]) || 0) - Number(monto)  // Permite negativo

      // Actualizar saldo
      await supabase.from('admin_saldos').upsert(
        { auth_user_id: adminAuthId, [campoSaldo]: nuevoSaldo, updated_at: new Date().toISOString() },
        { onConflict: 'auth_user_id' }
      )

      // Registrar reverso en historial
      await supabase.from('admin_saldos_historial').insert({
        admin_id: adminAuthId,
        tipo_movimiento: 'reverso_venta',
        moneda: moneda,
        monto: Number(monto),
        notas: `Reverso de Pedido #${pedido.numero_pedido} por Super Admin`,
        pedido_id: pedido.id
      })
    } catch (e) {
      console.error('Error en reverso manual de saldo admin:', e)
    }
  }

  // Modal: Asignar pedido a un admin
  const renderAsignarAdminModal = () => {
    if (!showAsignarAdminModal) return null
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, animation: 'fadeIn 0.2s ease' }}
        onClick={() => setShowAsignarAdminModal(false)}
      >
        <div style={{ backgroundColor: '#1a1d21', width: '100%', maxWidth: '480px', borderRadius: '20px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg,#8b5cf6,#00d2ff)', borderRadius: '4px 4px 0 0', position: 'absolute', top: '-28px', left: '-28px', right: '-28px' }}></div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>📤 Asignar Pedido a Administrador</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Selecciona el operario que se hará cargo de este pedido. El estado cambiará a <strong style={{color:'#8b5cf6'}}>PROCESANDO</strong>.</p>
          </div>
          {loadingAdmins ? (
            <div style={{ textAlign: 'center', padding: '30px' }}><div className="spinner" style={{ margin: '0 auto 10px' }}/><p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Cargando operarios...</p></div>
          ) : adminsList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay administradores disponibles.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', marginBottom: '20px' }}>
              {adminsList.map(a => (
                <button key={a.auth_user_id}
                  onClick={() => setAdminSeleccionado(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
                    borderRadius: '12px', border: adminSeleccionado?.auth_user_id === a.auth_user_id ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.07)',
                    backgroundColor: adminSeleccionado?.auth_user_id === a.auth_user_id ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>👤</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>{a.nombres} {a.apellidos || ''}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{a.usuario || a.nickname || 'operario'}</div>
                  </div>
                  {adminSeleccionado?.auth_user_id === a.auth_user_id && <span style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: '18px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAsignarAdmin}
              disabled={!adminSeleccionado}
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: adminSeleccionado ? '#8b5cf6' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: adminSeleccionado ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >📤 Asignar Pedido</button>
            <button onClick={() => setShowAsignarAdminModal(false)} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      </div>
    )
  }

  // Modal: Atribuir pedido como procesado por un admin
  const renderAtribuirModal = () => {
    if (!showAtribuirModal) return null
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, animation: 'fadeIn 0.2s ease' }}
        onClick={() => setShowAtribuirModal(false)}
      >
        <div style={{ backgroundColor: '#1a1d21', width: '100%', maxWidth: '480px', borderRadius: '20px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg,#22c55e,#00d2ff)', borderRadius: '4px 4px 0 0', position: 'absolute', top: '-28px', left: '-28px', right: '-28px' }}></div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>✅ Atribuir como Procesado por...</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Selecciona el operario que processó este pedido. El monto <strong style={{color:'#22c55e'}}>se acreditará a su billetera operativa</strong>.</p>
            <div style={{ marginTop: '10px', padding: '10px 14px', backgroundColor: 'rgba(255,171,0,0.08)', borderRadius: '10px', border: '1px solid rgba(255,171,0,0.25)', fontSize: '12px', color: '#ffab00' }}>
              ⚠️ Esto marcará el pedido como <strong>COMPLETADO</strong> y registrará la venta bajo el operario elegido. Esta acción es irreversible.
            </div>
          </div>
          {loadingAdmins ? (
            <div style={{ textAlign: 'center', padding: '30px' }}><div className="spinner" style={{ margin: '0 auto 10px' }}/><p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Cargando operarios...</p></div>
          ) : adminsList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay administradores disponibles.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '20px' }}>
              {adminsList.map(a => (
                <button key={a.auth_user_id}
                  onClick={() => setAdminSeleccionado(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
                    borderRadius: '12px', border: adminSeleccionado?.auth_user_id === a.auth_user_id ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.07)',
                    backgroundColor: adminSeleccionado?.auth_user_id === a.auth_user_id ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>👤</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>{a.nombres} {a.apellidos || ''}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{a.usuario || a.nickname || 'operario'}</div>
                  </div>
                  {adminSeleccionado?.auth_user_id === a.auth_user_id && <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: '18px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                if (!adminSeleccionado) return
                showAlert(`¿Confirmar que el pedido fue procesado por ${adminSeleccionado.nombres}? El monto se acreditará a su saldo operativo.`, 'confirm', () => updateEstadoConAdmin(selectedPedido.id, 'completado', adminSeleccionado))
              }}
              disabled={!adminSeleccionado}
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: adminSeleccionado ? '#22c55e' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: adminSeleccionado ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >✅ Confirmar Atribución</button>
            <button onClick={() => setShowAtribuirModal(false)} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      </div>
    )
  }

  const renderClientModal = () => {
    if (!showClientModal || !modalClient) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, animation: 'fadeIn 0.3s ease'
      }} onClick={() => setShowClientModal(false)}>
        <div style={{
          backgroundColor: '#1a1d21', width: '100%', maxWidth: '450px', borderRadius: '24px',
          padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(to right, #00d2ff, #3a7bd5)' }}></div>

          <button onClick={() => setShowClientModal(false)} style={{
            position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.05)',
            border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>×</button>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(0, 210, 255, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
              margin: '0 auto 16px', border: '2px solid var(--accent-primary)'
            }}>
              👤
            </div>
            <h2 style={{ fontSize: '22px', color: '#fff', marginBottom: '4px' }}>{maskSensitive(modalClient.nombres + ' ' + (modalClient.apellidos || ''))}</h2>
            <p style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '14px' }}>@{maskSensitive(modalClient.nickname || 'Usuario')}</p>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>📱 WhatsApp</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {modalClient.whatsapp ? maskSensitive(modalClient.whatsapp, 'phone') : 'No suministrado'}
                {modalClient.whatsapp && !isEmpleado && (
                  <a href={`https://wa.me/${modalClient.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: '12px', color: '#25D366', textDecoration: 'none', backgroundColor: 'rgba(37, 211, 102, 0.1)', padding: '4px 10px', borderRadius: '8px'
                  }}>Chatear</a>
                )}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>🏷️ Nickname</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>{modalClient.nickname || 'Sin nickname'}</div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>📅 Fecha de Registro</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>{formatFecha(modalClient.created_at || modalClient.fecha_registro)}</div>
            </div>
          </div>

          <button onClick={() => setShowClientModal(false)} style={{
            width: '100%', marginTop: '24px', padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none',
            fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
          }}>Cerrar Cartilla</button>
        </div>
      </div>
    );
  }

  const updatePedidoField = async (pedidoId, field, value) => {
    await supabase.from('pedidos').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', pedidoId)
    setSelectedPedido(prev => ({ ...prev, [field]: value }))
  }

  const updateItemEstado = async (itemId, nuevoEstado, adminMsg = null) => {
    const updateData = { estado: nuevoEstado }
    if (adminMsg !== null) updateData.notas_admin = adminMsg

    const { error } = await supabase.from('pedido_items').update(updateData).eq('id', itemId)
    if (error) {
       showAlert("Error al actualizar estado del paquete: " + error.message, 'error')
       return
    }
    
    setSelectedPedido(prev => {
       if(!prev || !prev.pedido_items) return prev
       const newItems = prev.pedido_items.map(i => i.id === itemId ? { ...i, ...updateData } : i)
       return { ...prev, pedido_items: newItems }
    })
    
    setPedidos(prev => prev.map(p => {
       if(p.id === selectedPedido?.id) {
          const newItems = p.pedido_items?.map(i => i.id === itemId ? { ...i, ...updateData } : i)
          return { ...p, pedido_items: newItems }
       }
       return p
    }))
  }

  const updateItemReference = async (itemId, referencia) => {
    const { error } = await supabase.from('pedido_items').update({ referencia_admin: referencia }).eq('id', itemId)
    if (error) {
       showAlert("Error al actualizar referencia: " + error.message, 'error')
       return
    }
    
    setSelectedPedido(prev => {
       if(!prev || !prev.pedido_items) return prev
       const newItems = prev.pedido_items.map(i => i.id === itemId ? { ...i, referencia_admin: referencia } : i)
       return { ...prev, pedido_items: newItems }
    })
    
    setPedidos(prev => prev.map(p => {
       if(p.id === selectedPedido?.id) {
          const newItems = p.pedido_items?.map(i => i.id === itemId ? { ...i, referencia_admin: referencia } : i)
          return { ...p, pedido_items: newItems }
       }
       return p
    }))
  }

  const updateItemCodigo = async (itemId, codigo) => {
    const { error } = await supabase.from('pedido_items').update({ codigo_entregado: codigo }).eq('id', itemId)
    if (error) {
       showAlert("Error al actualizar código: " + error.message, 'error')
       return
    }
    
    setSelectedPedido(prev => {
       if(!prev || !prev.pedido_items) return prev
       const newItems = prev.pedido_items.map(i => i.id === itemId ? { ...i, codigo_entregado: codigo } : i)
       return { ...prev, pedido_items: newItems }
    })
    
    setPedidos(prev => prev.map(p => {
       if(p.id === selectedPedido?.id) {
          const newItems = p.pedido_items?.map(i => i.id === itemId ? { ...i, codigo_entregado: codigo } : i)
          return { ...p, pedido_items: newItems }
       }
       return p
    }))
  }
  
  const handleConfirmRechazo = () => {
     if(!motivoRechazo.trim()) {
        showAlert("Debes escribir un motivo por el cual no se pudo recargar este paquete.", "error")
        return
     }
     updateItemEstado(rechazandoItem, 'fallido', motivoRechazo)
     setRechazandoItem(null)
     setMotivoRechazo('')
  }

  const confirmarCancelacionPagoNoEncontrado = async () => {
    if (!selectedPedido) return;
    if (!cancelacionMensaje.trim()) {
      showAlert("El mensaje de cancelación no puede estar vacío.", "error");
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();

    const updateData = {
      estado: 'cancelado',
      pago_verificado: false,
      observaciones: cancelacionMensaje,
      atendido_por_id: user.id,
      fecha_respuesta: now,
      updated_at: now
    };

    let msgFinal = cancelacionMensaje;
    let reembolsosRealizados = [];

    try {
      // 1. Detección y ejecución de reembolsos automáticos si aplica
      const refBaja = (selectedPedido.referencia_pago || "").toLowerCase();
      const needsRefund = refBaja.includes('billetera bs') || 
                          refBaja.includes('billetera usd') || 
                          refBaja.includes('pago parcial');

      if (needsRefund) {
        // Regex robusta: busca la palabra billetera y el monto que le sigue
        const regexValores = /(bs|usd):\s*[$]?\s*([0-9.,]+)/gi;
        let match;
        
        // Usamos un array de promesas si queremos paralelismo, o secuencial para evitar race conditions en la billetera
        // Secuencial es más seguro para integridad de saldos si es el mismo usuario
        while ((match = regexValores.exec(refBaja)) !== null) {
          const moneda = match[1].toLowerCase();
          const montoStr = match[2].replace(/\./g, '').replace(/,/g, '.');
          const monto = parseFloat(montoStr);
          
          if (monto > 0) {
            const { data: refundResult, error: refundError } = await supabase.rpc('reembolsar_pedido_rpc', {
              p_pedido_id: selectedPedido.id,
              p_admin_id: user.id,
              p_notas: `Reembolso automático por cancelación de pago no encontrado (Pedido #${selectedPedido.numero_pedido})`,
              p_moneda: moneda,
              p_monto: monto,
              p_cambiar_estado: false
            });

            if (!refundError && !refundResult?.error) {
              reembolsosRealizados.push(moneda === 'bs' ? formatBs(monto) : formatUSD(monto));
            } else {
              console.error(`Error en reembolso automático (${moneda}):`, refundError || refundResult?.error);
            }
          }
        }
      }

      // 2. Si hubo reembolsos, añadir posdata al mensaje
      if (reembolsosRealizados.length > 0) {
        msgFinal += `\n\nPD: El saldo de tu billetera utilizado en este pedido (${reembolsosRealizados.join(' y ')}) ha sido reintegrado exitosamente a tu cuenta.`;
        updateData.observaciones = msgFinal;
      }

      // 3. Actualizar el pedido
      const { error: updateError } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', selectedPedido.id);

      if (updateError) throw updateError;

      // 4. Enviar mensaje al chat automáticamente
      if (selectedPedido.cliente?.id) {
        const { error: chatError } = await supabase
          .from('soporte_mensajes')
          .insert({
            cliente_id: selectedPedido.cliente.id,
            remitente_id: perfil?.cliente_uuid || null,
            mensaje: msgFinal,
            leido: false,
            es_sistema: true
          });
        
        if (chatError) console.error("Error enviando mensaje al chat:", chatError);
      }

      // 5. Actualizar estado local
      playErrorSound();
      const pedFinal = { ...selectedPedido, ...updateData, reembolso_billetera: reembolsosRealizados.length > 0 };
      setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? pedFinal : p));
      setSelectedPedido(pedFinal);

      const alertMsg = reembolsosRealizados.length > 0
        ? `✅ Pedido cancelado. Se reintegraron ${reembolsosRealizados.join(' y ')} a la billetera del cliente.`
        : "Pedido cancelado y mensaje enviado al cliente.";
      
      showAlert(alertMsg, "success");
    } catch (err) {
      console.error("Error al cancelar pedido:", err);
      showAlert("Error al cancelar el pedido: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type = 'info', onConfirm = null) => {
    setAlertModal({ message, type, onConfirm });
  }

  const renderAlertModal = () => {
    if (!alertModal) return null;
    return (
      <AlertModal
        isOpen={!!alertModal}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={() => {
          if (alertModal.onConfirm) alertModal.onConfirm();
          setAlertModal(null);
        }}
        onCancel={() => setAlertModal(null)}
      />
    );
  }

  // Subir imagen adjunta
  const handleUploadImage = async (file) => {
    if (!file || !selectedPedido) return
    setUploading(true)
    file = await compressImage(file)
    const fileName = `pedido_${selectedPedido.id}_${Date.now()}-${file.name}`

    const { error } = await supabase.storage
      .from('pedidos-adjuntos')
      .upload(fileName, file, { cacheControl: '31536000', upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('pedidos-adjuntos')
        .getPublicUrl(fileName)

      // Append to existing images array (stored as JSON text)
      const currentImages = selectedPedido.imagenes_adjuntas
        ? JSON.parse(selectedPedido.imagenes_adjuntas)
        : []
      currentImages.push(publicUrl)
      const json = JSON.stringify(currentImages)

      await supabase.from('pedidos').update({ imagenes_adjuntas: json }).eq('id', selectedPedido.id)
      setSelectedPedido(prev => ({ ...prev, imagenes_adjuntas: json }))
    } else {
      showAlert('Error al subir la imagen: ' + error.message, 'error')
    }
    setUploading(false)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        handleUploadImage(file)
        break
      }
    }
  }

  const handleRemoveImage = async (urlToRemove) => {
    if (!selectedPedido) return
    const currentImages = selectedPedido.imagenes_adjuntas
      ? JSON.parse(selectedPedido.imagenes_adjuntas)
      : []
    const updated = currentImages.filter(url => url !== urlToRemove)
    const json = JSON.stringify(updated)
    await supabase.from('pedidos').update({ imagenes_adjuntas: json }).eq('id', selectedPedido.id)
    setSelectedPedido(prev => ({ ...prev, imagenes_adjuntas: json }))
  }

  const renderReferenciaConMonto = (ref, totalBs, totalUsd) => {
    if (!ref) return '-';
    if (!ref.includes('Pago Parcial')) return ref;

    const parts = ref.split('|');
    const refNum = parts[0].trim();
    
    // Extraer montos de billetera en el string (formato: "Billetera Bs: 743" o "Billetera USD: $10.00")
    const bsMatch = ref.match(/Billetera Bs:\s*([0-9.,]+)/i);
    const usdMatch = ref.match(/Billetera USD:\s*\$?\s*([0-9.,]+)/i);
    
    let walletBs = 0;
    let walletUsd = 0;

    if (bsMatch) {
      walletBs = parseFloat(bsMatch[1].replace(/\./g, '').replace(/,/g, '.'));
    }
    if (usdMatch) {
      walletUsd = parseFloat(usdMatch[1].replace(/\./g, '').replace(/,/g, '.'));
    }

    const remainingBs = totalBs - walletBs;
    const remainingUsd = totalUsd - walletUsd;

    if (refNum && (remainingBs > 0 || remainingUsd > 0)) {
      const montoRefLabel = remainingBs > 0 ? formatBs(remainingBs) : formatUSD(remainingUsd);
      return (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: '15px' }}>{refNum}</span>
          <span translate="no" className="notranslate" style={{ 
            backgroundColor: 'rgba(0, 210, 255, 0.15)', 
            color: 'var(--accent-primary)', 
            padding: '2px 8px', 
            borderRadius: '6px', 
            fontSize: '13px', 
            fontWeight: 900,
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 0 10px rgba(0, 210, 255, 0.1)'
          }}>
            {montoRefLabel}
          </span>
          <span style={{ opacity: 0.6, fontSize: '11px', fontWeight: 500 }}>
            | {parts.slice(1).join('|')}
          </span>
        </div>
      );
    }

    return ref;
  }

  // Vista de detalle de un pedido
  if (selectedPedido) {
    const est = getEstadoStyle(selectedPedido.estado)
    return (
      <div style={{ paddingLeft: embedded ? '0' : '16px', paddingBottom: '32px' }}>
        <div className="page-header mb-8 pedidos-header-responsive">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPedido(null)} style={{ padding: '4px 10px', backgroundColor: 'var(--bg-panel)', fontSize: '11px' }}>
              ← Volver
            </button>
            <h1 className="page-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
              Pedido #{selectedPedido.numero_pedido}
              <span style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px',
                backgroundColor: est.bg, color: est.color, fontWeight: 700
              }}>{est.label}</span>
            </h1>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatFecha(selectedPedido.created_at)}</span>
          </div>

          {/* Acciones Rápidas en la Cabecera */}
          {isAdmin && (
            <div className="pedidos-header-actions" style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  const now = new Date();
                  const hourStr = new Intl.DateTimeFormat('es-VE', {
                    timeZone: 'America/Caracas', hour: 'numeric', hour12: false
                  }).format(now);
                  const hour = parseInt(hourStr);

                  let saludo = 'Hola';
                  if (hour >= 0 && hour < 12) saludo = 'Buenos días';
                  else if (hour >= 12 && hour < 18) saludo = 'Buenas tardes';
                  else saludo = 'Buenas noches';

                  onNavigate('chats', {
                    targetClientId: selectedPedido.cliente_id,
                    prefill: `${saludo} Estimado Cliente; La administración se está comunicando contigo con respecto a tu orden #${selectedPedido.numero_pedido}: `
                  })
                }}
              >
                💬 Iniciar Chat
              </button>
              {/* Botones exclusivos del Super Admin */}
              {isSuperAdmin && selectedPedido.estado !== 'completado' && (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: '11px', color: '#8b5cf6', border: '1px solid #8b5cf6', fontWeight: 700 }}
                    title="Asignar este pedido a un operario específico"
                    onClick={openAsignarAdminModal}
                  >
                    📤 Asignar a Operario
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: '11px', color: '#22c55e', border: '1px solid #22c55e', fontWeight: 700 }}
                    title="Decretar que este pedido fue procesado por un operario y acreditarle el monto"
                    onClick={openAtribuirModal}
                  >
                    🏅 Atribuir a Operario
                  </button>
                </>
              )}
              {/* Botón Reversar: solo para super admin en pedidos COMPLETADOS */}
              {isSuperAdmin && selectedPedido.estado === 'completado' && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 10px', fontSize: '11px', color: '#ff5252', border: '1px solid #ff5252', fontWeight: 700 }}
                  title="Reversar el pedido: revierte el estado a PROCESANDO y descuenta el saldo del operario (puede quedar negativo)"
                  onClick={() => handleReversarCompletado(selectedPedido)}
                >
                  🔄 Reversar Completado
                </button>
              )}
              {/* Pedido CANCELADO: mostrar opciones de recuperación a cualquier admin */}
              {selectedPedido.estado === 'cancelado' ? (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: '11px', color: '#facc15', border: '1px solid #facc15', fontWeight: 700 }}
                    title="Liberar pedido: lo devuelve a estado pendiente sin asignación"
                    onClick={() => handleLiberarPedido(selectedPedido)}
                  >
                    🔓 Liberar Pedido
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: '11px', color: '#4ade80', border: '1px solid #4ade80', fontWeight: 700 }}
                    title="Marcar el pedido como pendiente para que pueda ser retomado"
                    onClick={() => showAlert('¿Deseas marcar este pedido como PENDIENTE para que pueda ser gestionado nuevamente?', 'confirm', async () => {
                      const { error } = await supabase.from('pedidos').update({ estado: 'pendiente', atendido_por_id: null, updated_at: new Date().toISOString() }).eq('id', selectedPedido.id);
                      if (!error) {
                        const upd = { ...selectedPedido, estado: 'pendiente', atendido_por_id: null };
                        setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? upd : p));
                        setSelectedPedido(upd);
                        showAlert('✅ Pedido restablecido a PENDIENTE.', 'success');
                      } else {
                        showAlert('Error al cambiar estado: ' + error.message, 'error');
                      }
                    })}
                  >
                    ⏳ Marcar Pendiente
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#22c55e', borderColor: '#22c55e', fontWeight: 700 }}
                    title="Marcar como completado directamente"
                    onClick={() => showAlert('¿Confirmar que este pedido fue COMPLETADO?', 'confirm', () => updateEstado(selectedPedido.id, 'completado'))}
                  >
                    ✅ Completado
                  </button>
                  {selectedPedido.reembolso_billetera !== true && (
                    <button
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(224, 64, 251, 0.1)', color: '#e040fb', border: '1px solid #e040fb' }}
                      onClick={() => handleReembolsoSelect(selectedPedido)}
                    >
                      💸 Devolver Fondo
                    </button>
                  )}
                </>
              ) : !selectedPedido.atendido_por_id ? (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ 
                    padding: '4px 12px', 
                    fontSize: '12px', 
                    backgroundColor: selectedPedido.pago_verificado === true ? '#8b5cf6' : 'var(--text-muted)', 
                    borderColor: selectedPedido.pago_verificado === true ? '#8b5cf6' : 'var(--text-muted)',
                    opacity: selectedPedido.pago_verificado === true ? 1 : 0.5,
                    cursor: selectedPedido.pago_verificado === true ? 'pointer' : 'not-allowed'
                  }}
                  onClick={() => handleTomarPedido(selectedPedido)}
                  title={selectedPedido.pago_verificado === true ? 'Tomar pedido para procesar' : 'Verifica el pago primero'}
                >
                  📥 Tomar pedido
                </button>
              ) : esElOperador(selectedPedido) ? (
                <>
                  {selectedPedido.estado !== 'pendiente' && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => updateEstado(selectedPedido.id, 'pendiente')}>
                      ⏳ Pendiente
                    </button>
                  )}
                  {selectedPedido.estado === 'procesando' && (
                    <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => updateEstado(selectedPedido.id, 'completado')}>
                      ✅ Pedido Completado
                    </button>
                  )}
                  {selectedPedido.estado !== 'pago_no_encontrado' && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '11px', color: '#ce93d8' }} onClick={() => updateEstado(selectedPedido.id, 'pago_no_encontrado')}>
                      🔍 Pago No Encontrado
                    </button>
                  )}
                  {selectedPedido.estado !== 'pago_duplicado' && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '11px', color: '#ffb74d' }} onClick={() => updateEstado(selectedPedido.id, 'pago_duplicado')}>
                      ⚠️ Pago Duplicado
                    </button>
                  )}
                  {selectedPedido.estado !== 'cancelado' && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '11px', color: '#ff5252' }} onClick={() => updateEstado(selectedPedido.id, 'cancelado')}>
                      ❌ Cancelar
                    </button>
                  )}
                  {/* Botón de reembolso */}
                  {!['completado', 'reembolsado'].includes(selectedPedido.estado) && selectedPedido.reembolso_billetera !== true && (
                    <button
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(224, 64, 251, 0.1)', color: '#e040fb', border: '1px solid #e040fb' }}
                      onClick={() => handleReembolsoSelect(selectedPedido)}
                    >
                      💸 Devolver Fondo
                    </button>
                  )}
                </>
              ) : (
                /* Pedido tomado por OTRO admin: solo super admin puede liberar */
                isSuperAdmin && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: '11px', color: '#facc15', border: '1px solid #facc15', fontWeight: 700 }}
                    title="Super Admin: liberar pedido asignado a otro administrador"
                    onClick={() => handleLiberarPedido(selectedPedido)}
                  >
                    🔓 Liberar (Super Admin)
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {renderClientModal()}
        {renderReembolsoModal()}
        {renderAsignarAdminModal()}
        {renderAtribuirModal()}

        <div className="pedidos-grid-responsive">
          {renderAlertModal()}
          {/* Info del pedido lateral (más compacto) */}
          <div className="card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase' }}>Resumen</h3>

              {/* Información del Cliente */}
              {selectedPedido.cliente ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px', border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }} onClick={() => { setModalClient(selectedPedido.cliente); setShowClientModal(true); }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{maskSensitive(selectedPedido.cliente.nombres + ' ' + (selectedPedido.cliente.apellidos || ''))}</div>
                    <div style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>{maskSensitive(selectedPedido.cliente.whatsapp, 'phone')}</div>
                  </div>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                    border: '1px solid var(--accent-primary)'
                  }}>👤</div>
                </div>
              ) : selectedPedido.cliente_id && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>⌛ Cargando cliente...</div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <div className="summary-row">
                <span className="summary-label">N° Pedido</span>
                <span className="summary-value" style={{ color: 'var(--accent-primary)' }}>#{selectedPedido.numero_pedido}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Fecha / Hora</span>
                <span className="summary-value">{formatFecha(selectedPedido.created_at)}</span>
              </div>
              <div className="summary-row" style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="summary-label">Referencia de Pago</span>
                  <span className="summary-value" style={{ color: 'var(--accent-success)' }}>
                    {renderReferenciaConMonto(selectedPedido.referencia_pago, selectedPedido.total_bs, selectedPedido.total_usd)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 600, color:
                        selectedPedido.pago_verificado === true ? 'var(--accent-success)' :
                          selectedPedido.pago_verificado === false ? 'var(--accent-error)' : 'var(--text-muted)'
                    }}>
                      {selectedPedido.pago_verificado === true ? 'Verificado' :
                        selectedPedido.pago_verificado === false ? 'Rechazado' : 'Sin Verificar'}
                    </span>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleVerificarPago(selectedPedido, true)}
                          style={{
                            width: '24px', height: '24px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            backgroundColor: selectedPedido.pago_verificado === true ? '#22c55e' : 'rgba(34, 197, 94, 0.15)',
                            color: selectedPedido.pago_verificado === true ? 'white' : '#22c55e', fontSize: '14px'
                          }}
                        >✓</button>
                        <button
                          onClick={() => handleVerificarPago(selectedPedido, false)}
                          style={{
                            width: '24px', height: '24px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            backgroundColor: selectedPedido.pago_verificado === false ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                            color: selectedPedido.pago_verificado === false ? 'white' : '#ef4444', fontSize: '14px'
                          }}
                        >✕</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOQUE DE CANCELACIÓN ESPECIAL (PAGO NO ENCONTRADO) */}
                {isAdmin && selectedPedido.pago_verificado === false && selectedPedido.estado !== 'cancelado' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '20px' }}>⚠️</span>
                      <h4 style={{ margin: 0, color: '#ef4444', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>Pago No Verificado</h4>
                    </div>
                    
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Si el pago no existe en el banco, puedes cancelar el pedido con el siguiente mensaje predeterminado:
                    </p>

                    <textarea
                      value={cancelacionMensaje}
                      onChange={(e) => setCancelacionMensaje(e.target.value)}
                      style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#fff',
                        padding: '12px',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        marginBottom: '12px',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />

                    <button
                      onClick={confirmarCancelacionPagoNoEncontrado}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.filter = 'brightness(1.1)'}
                      onMouseLeave={(e) => e.target.style.filter = 'none'}
                    >
                      {loading ? 'Procesando...' : '❌ Cancelar El Pedido'}
                    </button>
                  </div>
                )}
              </div>
              <div className="summary-row" translate="no" className="notranslate">
                <span className="summary-label">Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--accent-success)' }}>{formatBs(selectedPedido.total_bs)}</div>
                  {isAdmin && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatUSD(selectedPedido.total_usd)}</div>}
                </div>
              </div>

              {selectedPedido.cashback_aplicado && (
                (() => {
                  const p = selectedPedido.cashback_porcentaje || config?.cashback_porcentaje || 0;
                  const isBs = selectedPedido.cashback_moneda === 'bs' || (!selectedPedido.cashback_moneda && (selectedPedido.referencia_pago?.toLowerCase().includes('bs') || selectedPedido.referencia_pago?.toLowerCase().includes('móvil') || selectedPedido.referencia_pago?.toLowerCase().includes('movil')));
                  const monto = selectedPedido.cashback_monto || (isBs ? Number(selectedPedido.total_bs) * (p/100) : Number(selectedPedido.total_usd) * (p/100));
                  return (
                    <div translate="no" className="notranslate" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.2)', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>💸 <span style={{color: '#22c55e', fontWeight: 600}}>Cash Back ({p}%)</span></span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '15px' }}>+{isBs ? formatBs(monto) : (isAdmin ? formatUSD(monto) : '')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monto retornado a Billetera</div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Comprobante de Pago */}
              {selectedPedido.comprobante_url ? (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📎 Comprobante de Pago</div>
                  <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onClick={() => window.open(selectedPedido.comprobante_url, '_blank')}
                  >
                    <img
                      src={getOptimizedImageUrl(selectedPedido.comprobante_url, 600)}
                      alt="Comprobante"
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', backgroundColor: 'var(--bg-panel)', display: 'block' }}
                    />
                    <div style={{ padding: '6px', textAlign: 'center', fontSize: '11px', color: 'var(--accent-primary)', backgroundColor: 'rgba(0,210,255,0.05)', fontWeight: 600 }}>↗ Ver en tamaño completo</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>📎 Comprobante</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No adjuntado</span>
                </div>
              )}

              {/* Administrador que procesa */}
              {selectedPedido.atendido_por_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {selectedPedido.estado === 'completado' ? '✅ Procesado por' :
                      selectedPedido.estado === 'cancelado' ? '❌ Cancelado por' : '👤 Tomado por'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                      {esElOperador(selectedPedido) ? 
                        (perfil.nickname || perfil.nombres || perfil.usuario || 'Tú') : 
                        (selectedPedido.atendido_por?.nickname || selectedPedido.atendido_por?.nombres || 'Otro Admin')
                      }
                    </span>

                    {/* Botón Liberar Pedido */}
                    {isAdmin && esElOperador(selectedPedido) && selectedPedido.estado === 'procesando' && (
                      <button
                        onClick={() => handleLiberarPedido(selectedPedido)}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid rgba(255, 82, 82, 0.3)',
                          color: '#ff5252',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'rgba(255, 82, 82, 0.15)';
                          e.target.style.borderColor = '#ff5252';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.borderColor = 'rgba(255, 82, 82, 0.3)';
                        }}
                      >
                        🔓 Liberar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fecha de Respuesta */}
            {selectedPedido.fecha_respuesta && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)', marginTop: '16px' }}>
                <span style={{ color: 'var(--text-muted)' }}>📅 Fecha de Respuesta</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{formatFecha(selectedPedido.fecha_respuesta)}</span>
              </div>
            )}

            {/* Observaciones de la Administración (Nuevo: Visible para el Cliente) */}
            {selectedPedido.observaciones && (
              <div style={{
                marginTop: '16px', padding: '16px', borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                animation: 'pulseGlow 2s infinite ease-in-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#f59e0b' }}>
                  <span style={{ fontSize: '18px' }}>📝</span>
                  <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px' }}>Nota de Administración</span>
                </div>
                <p style={{
                  margin: 0, fontSize: '15px', color: 'var(--text-primary)',
                  fontWeight: 500, lineHeight: '1.5', whiteSpace: 'pre-line'
                }}>
                  {selectedPedido.observaciones}
                </p>
              </div>
            )}

            {/* Capturas de Entrega (Visible para Admin y Cliente) */}
            {(() => {
              const images = selectedPedido.imagenes_adjuntas ? JSON.parse(selectedPedido.imagenes_adjuntas) : []
              if (images.length === 0) return null
              return (
                <div style={{ 
                  marginTop: '16px', padding: '16px', borderRadius: '12px', 
                  backgroundColor: 'rgba(0, 210, 255, 0.04)', 
                  border: '1px solid rgba(0, 210, 255, 0.2)',
                  animation: 'fadeIn 0.5s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px' }}>🖼️</span>
                    <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px', color: 'var(--accent-primary)' }}>Capturas de Entrega</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {images.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 'calc(50% - 5px)', minWidth: '100px' }}>
                        <div 
                          style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.2)' }}
                          onClick={() => window.open(url, '_blank')}
                        >
                          <img 
                            src={getOptimizedImageUrl(url, 400)} 
                            alt={`Entrega ${idx + 1}`} 
                            style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }} 
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                          />
                          <div style={{ padding: '4px', textAlign: 'center', fontSize: '10px', color: 'var(--accent-primary)', backgroundColor: 'rgba(0,210,255,0.05)', fontWeight: 600 }}>Ampliar ↗</div>
                        </div>
                        {isAdmin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(url); }} 
                            style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.4)', zIndex: 10 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Panel de Gestión (Unificado) */}
            {isAdmin && (
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <div className="pedidos-gestion-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Observaciones</label>
                    <textarea
                      placeholder="..."
                      value={selectedPedido.observaciones || ''}
                      onChange={e => setSelectedPedido(prev => ({ ...prev, observaciones: e.target.value }))}
                      onBlur={e => updatePedidoField(selectedPedido.id, 'observaciones', e.target.value)}
                      style={{ width: '100%', height: '40px', fontSize: '11px', backgroundColor: 'var(--bg-card)', padding: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Ref. Recarga</label>
                    <input
                      placeholder="Ref..."
                      value={selectedPedido.referencia_recarga || ''}
                      onChange={e => setSelectedPedido(prev => ({ ...prev, referencia_recarga: e.target.value }))}
                      onBlur={e => updatePedidoField(selectedPedido.id, 'referencia_recarga', e.target.value)}
                      style={{ width: '100%', height: '40px', fontSize: '11px', backgroundColor: 'var(--bg-card)', padding: '6px' }}
                    />
                  </div>
                </div>

                {/* Capturas de Recarga (Super Compacto) */}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{
                    padding: '6px 12px', borderRadius: '6px', border: '1px dashed var(--border-color)',
                    backgroundColor: 'var(--bg-card)', fontSize: '11px', cursor: 'pointer', flex: 1, textAlign: 'center', color: '#fff', whiteSpace: 'nowrap'
                  }}>
                    📎 Explorar Archivo
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleUploadImage(e.target.files[0]); e.target.value = '' }} />
                  </label>
                  <input 
                    type="text" 
                    value=""
                    onChange={() => {}}
                    placeholder="Click aquí y Ctrl+V para pegar imagen" 
                    onPaste={(e) => {
                      e.preventDefault();
                      handlePaste(e);
                    }} 
                    style={{
                      padding: '6px 12px', borderRadius: '6px', border: '1px dashed var(--border-color)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', fontSize: '11px', flex: 2, textAlign: 'center', color: '#fff', outline: 'none', cursor: 'text', transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => { e.target.placeholder = "Presiona Ctrl+V ahora..."; e.target.style.borderColor = "var(--accent-primary)"; }}
                    onBlur={(e) => { e.target.placeholder = "Click aquí y Ctrl+V para pegar imagen"; e.target.style.borderColor = "var(--border-color)"; }}
                  />
                </div>


                {/* Status Ocupado */}
                {selectedPedido.atendido_por_id && !esElOperador(selectedPedido) && (
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', color: 'var(--accent-error)', fontSize: '11px', marginTop: '8px', textTransform: 'capitalize' }}>
                    🚫 En proceso por {selectedPedido.atendido_por?.nickname || selectedPedido.atendido_por?.nombres || 'otro administrador'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items del pedido */}
          <div className="card" style={{ padding: '12px' }}>
            <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase' }}>Paquetes (Actualizado)</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {(selectedPedido.pedido_items || []).map((item, idx) => (
                <div key={idx} style={{
                  padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '12px',
                  border: `2px solid ${item.estado === 'completado' ? 'rgba(34, 197, 94, 0.4)' : item.estado === 'fallido' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'}`,
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {(() => {
                        // Búsqueda exhaustiva del ícono en todas las posibles estructuras de Supabase
                        const iconUrl = item.producto_icono || 
                                      (Array.isArray(item.productos) ? item.productos[0]?.icono_url : item.productos?.icono_url) ||
                                      (Array.isArray(item.producto) ? item.producto[0]?.icono_url : item.producto?.icono_url) ||
                                      item.icono_url; // Fallback final si viniera plano

                        if (!iconUrl) return null;

                        return (
                          <img 
                            src={getOptimizedImageUrl(iconUrl, 150)} 
                            alt="Icono" 
                            style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        );
                      })()}
                      <div>
                        <div className="product-item-title">{item.producto_nombre}</div>
                        {/* ESTADO LABEL CLIENTE/GENERAL */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          {item.estado === 'completado' && <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{fontSize: '14px'}}>✅</span> Recargado</span>}
                          {item.estado === 'fallido' && <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{fontSize: '14px'}}>❌</span> Error</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div translate="no" className="notranslate" style={{ textAlign: 'right' }}>
                       <span className="product-item-price">{formatBs(item.precio_bs)}</span>

                       {/* BOTONES ADMIN */}
                       {isAdmin && esElOperador(selectedPedido) && selectedPedido.estado === 'procesando' && (
                         <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button
                               onClick={() => updateItemEstado(item.id, item.estado === 'completado' ? 'pendiente' : 'completado', null)}
                               style={{ width: '32px', height: '32px', border: '2px solid #22c55e', backgroundColor: item.estado === 'completado' ? '#22c55e' : 'rgba(34, 197, 94, 0.1)', color: item.estado === 'completado' ? '#fff' : '#22c55e', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                               title={item.estado === 'completado' ? "Desmarcar completo" : "Marcar como recargado/completado"}
                            >✓</button>
                            <button
                               onClick={() => { setRechazandoItem(item.id === rechazandoItem ? null : item.id); setMotivoRechazo(item.notas_admin || ''); }}
                               style={{ width: '32px', height: '32px', border: '2px solid #ef4444', backgroundColor: item.estado === 'fallido' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)', color: item.estado === 'fallido' ? '#fff' : '#ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                               title="Marcar como fallido y agregar motivo"
                            >✕</button>
                         </div>
                       )}
                    </div>
                  </div>

                <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🎮 {item.juego_nombre} · Cantidad: {item.cantidad}
                    {((item.productos || item.producto || (Array.isArray(item.productos) ? item.productos[0] : null))?.entrega_automatica) && !item.codigo_entregado && stockCounts[(item.productos || item.producto || (Array.isArray(item.productos) ? item.productos[0] : null))?.id] === 0 && (
                      <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>⚠️ Sin Stock en Baúl</span>
                    )}
                  </div>

                  {/* CAJA DE REFERENCIA (ADMIN -> CLIENTE) */}
                  {isAdmin && esElOperador(selectedPedido) && selectedPedido.estado === 'procesando' ? (
                     <div style={{ marginBottom: '8px' }}>
                        <input 
                           type="text" 
                           placeholder="Escribir Ref. de Recarga (Ej: Transacción #83274)" 
                           defaultValue={item.referencia_admin || ''}
                           onBlur={(e) => {
                             if (e.target.value !== (item.referencia_admin || '')) {
                               updateItemReference(item.id, e.target.value)
                             }
                           }}
                           style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(0, 210, 255, 0.3)', backgroundColor: 'rgba(0, 210, 255, 0.05)', color: 'var(--accent-primary)', fontSize: '13px', outline: 'none', fontWeight: 600 }}
                        />
                        
                        {/* INPUT CÓDIGO GIFT CARD */}
                        <div style={{ marginTop: '8px' }}>
                           <input 
                              type="text" 
                              placeholder="Escribir Código de Gift Card (Ej: XXXX-XXXX-XXXX)" 
                              defaultValue={item.codigo_entregado || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (item.codigo_entregado || '')) {
                                  updateItemCodigo(item.id, e.target.value)
                                }
                              }}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: '#22c55e', fontSize: '13px', outline: 'none', fontWeight: 700 }}
                           />
                        </div>
                     </div>
                  ) : item.referencia_admin && (
                     <div style={{ marginBottom: '8px', fontSize: '13px', padding: '6px 10px', backgroundColor: 'rgba(0, 210, 255, 0.08)', borderRadius: '6px', border: '1px dashed rgba(0, 210, 255, 0.3)', color: 'var(--accent-primary)', fontWeight: 700, display: 'inline-block' }}>
                        📌 Ref. Recarga: {item.referencia_admin}
                     </div>
                  )}

                  {/* Datos de recarga */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {item.metodo_recarga === 'solo_correo' ? (
                      <div style={{ fontSize: '16px', padding: '10px 14px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)' }}>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>📧 {item.account_email}</div>
                      </div>
                    ) : item.metodo_recarga === 'solo_usuario' ? (
                      <div style={{ fontSize: '16px', padding: '10px 14px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)' }}>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>👤 {item.account_user}</div>
                      </div>
                    ) : item.metodo_recarga === 'cuenta_completa' ? (
                      <div style={{ fontSize: '16px', padding: '10px 14px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)' }}>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>📧 {item.account_email}</div>
                        <div style={{ color: 'var(--accent-primary)', marginTop: '4px', fontFamily: 'monospace' }}>🔑 {item.account_password}</div>
                      </div>
                    ) : item.metodo_recarga === 'usuario_clave' ? (
                      <div style={{ fontSize: '16px', padding: '10px 14px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)' }}>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>👤 {item.account_user}</div>
                        <div style={{ color: 'var(--accent-primary)', marginTop: '4px', fontFamily: 'monospace' }}>🔑 {item.account_password}</div>
                      </div>
                    ) : item.metodo_recarga === 'id_zone' ? (
                      <div style={{ fontSize: '16px', padding: '10px 14px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>🆔 ID: {item.player_id} | 🌐 ZONE ID: {item.zone_id}</span>
                        </div>
                        {item.nickname && <div style={{ fontSize: '14px', color: '#fff', marginTop: '4px', fontWeight: 600 }}>👤 Nickname: {item.nickname}</div>}
                      </div>
                    ) : item.player_id ? (
                      <div style={{ fontSize: '20px', color: 'var(--accent-primary)', fontWeight: 800 }}>
                        🆔 {item.player_id}
                        {item.nickname && <div style={{ fontSize: '15px', color: '#fff', marginTop: '4px', fontWeight: 700 }}>👤 {item.nickname}</div>}
                      </div>
                    ) : null}
                  </div>

                  {/* CÓDIGO ENTREGADO (BAÚL) */}
                  {item.codigo_entregado && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '16px', 
                      backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                      borderRadius: '12px', 
                      border: '2px solid rgba(34, 197, 94, 0.4)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>🎁 Código de Gift Card</div>
                      <div style={{ 
                        fontSize: '22px', 
                        fontFamily: 'monospace', 
                        fontWeight: 900, 
                        color: '#fff', 
                        letterSpacing: '2px',
                        textShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                      }}>
                        {item.codigo_entregado}
                      </div>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(item.codigo_entregado); alert('Código copiado al portapapeles'); }}
                        style={{ marginTop: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        📋 Copiar Código
                      </button>
                    </div>
                  )}
                  
                  {/* CAJA DE SELECCIÓN DE RECHAZO (ADMIN) */}
                  {rechazandoItem === item.id && isAdmin && (
                     <div style={{ marginTop: '12px', padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', animation: 'fadeIn 0.2s' }}>
                       <label style={{ display: 'block', fontSize: '12px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Motivo del Fallo de Recarga:</label>
                       <textarea 
                          placeholder="Ej: El ID proporcionado no corresponde a ninguna cuenta en la región especificada..." 
                          value={motivoRechazo} 
                          onChange={(e) => setMotivoRechazo(e.target.value)}
                          style={{ width: '100%', height: '60px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'white', padding: '10px', fontSize: '14px', outline: 'none' }}
                       />
                       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                          <button onClick={() => setRechazandoItem(null)} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                          <button onClick={handleConfirmRechazo} style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Marcar como Fallido</button>
                       </div>
                     </div>
                  )}

                  {/* NOTA DE MOTIVO DE FALLO (VISIBLE SIEMPRE SI EXISTE) */}
                  {item.estado === 'fallido' && item.notas_admin && (
                     <div style={{ marginTop: '12px', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                       <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Detalles del Error</div>
                       <div style={{ fontSize: '14px', color: '#ffb3b3', whiteSpace: 'pre-line' }}>{item.notas_admin}</div>
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Vista de lista
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: embedded ? '0' : '0 32px 32px' }}>
      <style>{`
        .orders-table-wrapper {
          overflow-x: auto !important;
          border-radius: 16px;
        }
        /* Desktop Styles */
        @media (min-width: 769px) {
          .orders-table {
            width: 100% !important;
            min-width: 950px !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            background-color: #1a1d21 !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
          }
          .orders-table thead tr {
            background-color: #2a2f36 !important;
            height: 38px !important;
          }
          .orders-table th {
            padding: 0 10px !important;
            color: rgba(255,255,255,0.7) !important;
            font-size: 10px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            white-space: nowrap !important;
            text-align: center !important;
            font-weight: 700 !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            vertical-align: middle !important;
          }
          .orders-table th:first-child, .orders-table td:first-child { text-align: center !important; }
          
          .pedido-row-modern {
            background-color: transparent !important;
            transition: background-color 0.2s ease !important;
            border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          }
          .pedido-row-modern:hover {
            background-color: rgba(255,255,255,0.03) !important;
          }
          .pedido-row-modern.assigned-to-me {
            background-color: rgba(139, 92, 246, 0.08) !important;
            border-left: 3px solid #8b5cf6 !important;
          }
          .orders-table td {
            padding: 8px 10px !important;
            color: #fff !important;
            font-size: 12px !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
            text-align: center !important;
          }
          .orders-table td:nth-child(3) { text-align: left !important; } /* Cliente alineado a la izquierda */
          .orders-table .desktop-only { display: table-cell !important; }
        }

        /* Sincronización de visibilidad para tablets medianas */
        @media (min-width: 769px) and (max-width: 1100px) {
          .orders-table .desktop-only {
            display: none !important;
          }
        }

        /* Mobile Specific Adjustment */
        @media (max-width: 768px) {
          .orders-table-wrapper {
            overflow: visible !important;
          }
          .orders-table {
            border: none !important;
            background: transparent !important;
          }
          .pedido-row-modern {
            margin-bottom: 12px !important;
            border: 1px solid var(--border-color) !important;
            background: var(--bg-card) !important;
            border-radius: 12px !important;
            padding: 10px !important;
          }
          .pedido-row-modern.assigned-to-me {
            border: 2px solid #8b5cf6 !important;
            background: rgba(139, 92, 246, 0.06) !important;
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.15) !important;
          }
        }
      `}</style>
      {!embedded && (
        <div className="page-header mb-24">
          <h1 className="page-title">📋 Pedidos</h1>
          <p className="page-subtitle">Gestiona los pedidos realizados por los clientes</p>
        </div>
      )}

      {renderAlertModal()}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          Cargando pedidos...
        </div>
      ) : (
        <>
          {/* FILTROS POR ESTADO */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            {/* Botón selector principal */}
            <div 
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                boxShadow: showFilterDropdown ? '0 0 0 2px var(--accent-primary)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {FILTROS.find(f => f.key === filtroEstado)?.icon} 
                {FILTROS.find(f => f.key === filtroEstado)?.label} 
                ({filterPedidos(pedidos, filtroEstado).length})
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', transition: 'transform 0.2s', transform: showFilterDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </div>
            </div>

            {/* Menú desplegable */}
            {showFilterDropdown && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                  onClick={() => setShowFilterDropdown(false)} 
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  {FILTROS.map(f => {
                    const count = filterPedidos(pedidos, f.key).length
                    const isActive = filtroEstado === f.key
                    const style = f.key !== 'todos' ? getEstadoStyle(f.key) : { bg: 'transparent', color: 'var(--text-primary)' }
                    
                    return (
                      <div
                        key={f.key}
                        onClick={() => { 
                          setFiltroEstado(f.key); 
                          setCurrentPage(1); 
                          setShowFilterDropdown(false); 
                        }}
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,255,255,0.05)' : 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: isActive ? 700 : 500, color: isActive ? style.color : 'var(--text-primary)' }}>
                          {f.icon} {f.label}
                        </div>
                        <span style={{
                          backgroundColor: isActive ? style.color : 'rgba(255,255,255,0.1)',
                          color: isActive ? '#000' : 'var(--text-secondary)',
                          padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700
                        }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* BUSCADOR */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '8px 16px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '18px', marginRight: '10px', color: 'var(--text-muted)' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por n° de pedido, cliente, ref. de pago, ID de jugador o cuenta..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(1); }}
              style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}
            />
            {busqueda && (
              <button 
                onClick={() => { setBusqueda(''); setCurrentPage(1); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                title="Limpiar búsqueda"
              >
                ✖
              </button>
            )}
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No hay pedidos en esta categoría</h3>
              <p style={{ color: 'var(--text-muted)' }}>Selecciona otra categoría o espera a que se registren nuevos pedidos.</p>
            </div>
          ) : (
            <>
              <div className="orders-table-wrapper">
                <table className="orders-table table-cards-mobile">
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>ID</th>
                      <th className="desktop-only" style={{ width: '120px' }}>Fecha</th>
                      <th style={{ textAlign: 'left', width: '150px', paddingLeft: '15px !important' }}>Cliente</th>
                      <th style={{ width: '90px' }}>Juego</th>
                      <th style={{ width: '130px' }}>Paquete</th>
                      <th className="desktop-only" style={{ width: '90px' }}>Ref</th>
                      <th style={{ width: '80px' }}>Total</th>
                      <th className="desktop-only" style={{ width: '90px' }}>Admin</th>
                      <th style={{ width: '100px' }}>Pago</th>
                      <th style={{ width: '130px' }}>Estado</th>
                      <th style={{ width: '100px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPedidos.map(pedido => {
                      const est = getEstadoStyle(pedido.estado)
                      const items = pedido.pedido_items || []
                      const juegos = [...new Set(items.map(i => i.juego_nombre))]
                      const paquetes = items.map(i => `${i.producto_nombre}${i.cantidad > 1 ? ` x${i.cantidad}` : ''}`)

                      return (
                        <tr 
                          key={pedido.id} 
                          onClick={() => handleOpenPedido(pedido)}
                          className={`pedido-row-modern ${esElOperador(pedido) ? 'assigned-to-me' : ''}`}
                        >
                          <td data-label="ID" style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              <span>#{pedido.numero_pedido}</span>
                              {pedido.atendido_por && (
                                <span style={{
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: esElOperador(pedido) ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                  color: esElOperador(pedido) ? '#d8b4fe' : '#a1a1aa',
                                  border: `1px solid ${esElOperador(pedido) ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  👤 {esElOperador(pedido) ? 'Asignado a ti' : (pedido.atendido_por.nombres || 'Admin')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td data-label="Fecha" className="desktop-only" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                            {formatFecha(pedido.created_at)}
                          </td>
                          <td data-label="Cliente" style={{ fontWeight: 600, fontSize: '12px' }}>
                            {pedido.cliente ?
                              maskSensitive(`${pedido.cliente.nombres} ${pedido.cliente.apellidos?.toLowerCase() === 'pendiente' ? '' : (pedido.cliente.apellidos || '')}`.trim()) :
                              '-'
                            }
                          </td>
                          <td data-label="Juego" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                            {juegos[0] || '-'}
                          </td>
                          <td data-label="Paquete" style={{ maxWidth: '160px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                              {paquetes[0] || '-'}
                            </div>
                          </td>
                          <td data-label="Ref" className="desktop-only" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                            {pedido.referencia_pago || '-'}
                          </td>
                          <td data-label="Total" style={{ fontWeight: 800, color: '#22c55e', fontSize: '13px' }}>
                            <span translate="no" className="notranslate">{formatBs(pedido.total_bs)}</span>
                          </td>
                          <td data-label="Admin" className="desktop-only" style={{ color: pedido.atendido_por_id ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                            {pedido.atendido_por ? pedido.atendido_por.nombres : '-'}
                          </td>
                          <td data-label="Pago">
                            {(() => {
                              let text = 'PENDIENTE';
                              let color = '#facc15';
                              let bg = 'rgba(250, 204, 21, 0.1)';
                              let border = 'rgba(250, 204, 21, 0.2)';

                              if (pedido.pago_verificado === true) {
                                text = 'VERIFICADO';
                                color = '#22c55e';
                                bg = 'rgba(34, 197, 94, 0.1)';
                                border = 'rgba(34, 197, 94, 0.2)';
                              } else if (pedido.estado === 'pago_no_encontrado') {
                                text = 'NO ENCONTRADO';
                                color = '#ef4444';
                                bg = 'rgba(239, 68, 68, 0.1)';
                                border = 'rgba(239, 68, 68, 0.2)';
                              } else if (pedido.estado === 'pago_duplicado') {
                                text = 'DUPLICADO';
                                color = '#ffb74d';
                                bg = 'rgba(255, 183, 77, 0.1)';
                                border = 'rgba(255, 183, 77, 0.2)';
                              } else if (pedido.pago_verificado === false) {
                                text = 'RECHAZADO';
                                color = '#ef4444';
                                bg = 'rgba(239, 68, 68, 0.1)';
                                border = 'rgba(239, 68, 68, 0.2)';
                              }

                              return (
                                <span style={{
                                  fontSize: '9px', padding: '4px 8px', borderRadius: '6px', fontWeight: 800,
                                  backgroundColor: bg, color: color, border: `1px solid ${border}`
                                }}>
                                  {text}
                                </span>
                              );
                            })()}
                          </td>
                          <td data-label="Estado">
                            <span style={{
                              fontSize: '9px', padding: '4px 8px', borderRadius: '6px',
                              backgroundColor: est.bg, color: est.color, fontWeight: 800,
                              border: `1px solid ${est.color}33`, textTransform: 'uppercase'
                            }}>
                              {est.label.length > 12 ? est.label.substring(0, 10) + '..' : est.label}
                            </span>
                          </td>
                          <td data-label="Acción">
                            <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                              Ver
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Controles de Paginación */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, pedidosFiltrados.length)} de {pedidosFiltrados.length} pedidos
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      style={{ padding: '6px 12px', opacity: currentPage === 1 ? 0.5 : 1 }}
                    >
                      ← Anterior
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 8px' }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600,
                            backgroundColor: currentPage === page ? 'var(--accent-primary)' : 'transparent',
                            color: currentPage === page ? '#fff' : 'var(--text-muted)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      style={{ padding: '6px 12px', opacity: currentPage === totalPages ? 0.5 : 1 }}
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
