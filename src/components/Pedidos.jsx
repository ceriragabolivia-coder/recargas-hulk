import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import { playSuccessSound, playCashRegisterSound, playErrorSound, formatBs } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function Pedidos({ filterKey, params, onNavigate }) {
  const normalizedParams = typeof params === 'object' && params !== null ? params : { filterKey: params };
  const incomingFilterKey = normalizedParams.filterKey || filterKey;
  const targetOrderId = normalizedParams.orderId;
  const { user, perfil } = useAuth()
  const isAdmin = perfil?.rol === 'admin'
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState(incomingFilterKey === 'ordenes_pendientes' ? 'pendiente' : (incomingFilterKey || 'todos'))
  const [uploading, setUploading] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [modalClient, setModalClient] = useState(null)
  const [alertModal, setAlertModal] = useState(null) // { title, message, type, onConfirm }

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  async function fetchPedidos() {
    setLoading(true)
    let query = supabase
      .from('pedidos')
      .select('*, pedido_items(*)')
      .order('created_at', { ascending: false })

    if (user && !isAdmin) {
      query = query.eq('cliente_id', user.id)
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
  // Link directo desde Billetera u otras secciones
  useEffect(() => {
    if (targetOrderId && pedidos.length > 0) {
      const order = pedidos.find(p => p.id === targetOrderId)
      if (order) {
        setSelectedPedido(order)
      }
    }
  }, [targetOrderId, pedidos])
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

  let pedidosFiltrados = pedidos
  if (filtroEstado === 'pagos_pendientes') {
    pedidosFiltrados = pedidos.filter(p => p.pago_verificado === null && p.estado !== 'cancelado')
  } else if (filtroEstado === 'recargas_pendientes') {
    pedidosFiltrados = pedidos.filter(p => p.pago_verificado === true && p.estado !== 'completado' && p.estado !== 'cancelado')
  } else if (filtroEstado !== 'todos') {
    pedidosFiltrados = pedidos.filter(p => p.estado === filtroEstado)
  }

  // Cálculos de Paginación
  const totalPages = Math.ceil(pedidosFiltrados.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPedidos = pedidosFiltrados.slice(startIndex, startIndex + itemsPerPage)

  const updateEstado = async (pedidoId, nuevoEstado) => {
    // 1. Obtener el pedido actual
    const { data: pedidoActual } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*)')
      .eq('id', pedidoId)
      .single()

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
        for (const item of (pedidoActual.pedido_items || [])) {
          const { error: rpcError } = await supabase.rpc('registrar_venta_rpc', {
            p_producto_id: item.producto_id,
            p_cantidad: item.cantidad,
            p_notas: `Pedido #${pedidoActual.numero_pedido}`,
            p_cliente_id: pedidoActual.cliente_id,
            p_metodo_pago_id: pedidoActual.metodo_pago_id,
            p_referencia_pago: pedidoActual.referencia_pago,
            p_player_id: item.player_id,
            p_account_email: item.account_email,
            p_account_password: item.account_password,
            p_vendedor_id: perfil?.cliente_uuid
          })
          if (rpcError) throw rpcError
        }
        updateData.venta_registrada = true
      } catch (err) {
        console.error('Error al registrar venta:', err)
        showAlert('Error al registrar la venta: ' + err.message, 'error')
        return // No procedemos con el update del estado si falló el registro de venta
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
    } else {
      showAlert('Error al actualizar el pedido: ' + error.message, 'error')
      return
    }

    // Re-fetch or update selectedPedido if it's the one being viewed
    if (selectedPedido?.id === pedidoId) {
      const { data: updatedPedido } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*)')
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

  const handleReembolsoSelect = (pedido) => {
    setReembolsoPedido(pedido);
    setShowReembolsoModal(true);
  }

  const ejecutarReembolso = async (pedido, moneda) => {
    setShowReembolsoModal(false);
    setLoading(true);
    const { data, error } = await supabase.rpc('reembolsar_pedido_rpc', {
      p_pedido_id: pedido.id,
      p_admin_id: user.id,
      p_notas: `Reembolso administrativo por pedido #${pedido.numero_pedido} (${moneda === 'bs' ? 'Bolívares' : 'USD'})`,
      p_moneda: moneda
    });

    if (error) {
      console.error("Error en reembolso:", error);
      showAlert("Error al procesar el reembolso: " + error.message, 'error');
    } else if (data?.error) {
      showAlert(data.error, 'error');
    } else {
      playCashRegisterSound();
      const monedaLabel = moneda === 'bs' ? formatBs(pedido.total_bs) : `$${Number(pedido.total_usd).toFixed(2)}`;
      showAlert(`✅ Pedido reembolsado con éxito. ${monedaLabel} acreditados a la billetera ${moneda === 'bs' ? 'Bolívares' : 'USD'} del cliente.`, 'success');
      const updateData = { estado: 'reembolsado', updated_at: new Date().toISOString() };
      setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, ...updateData } : p));
      setSelectedPedido(prev => ({ ...prev, ...updateData }));
    }
    setLoading(false);
  }

  const renderReembolsoModal = () => {
    if (!showReembolsoModal || !reembolsoPedido) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease'
      }} onClick={() => setShowReembolsoModal(false)}>
        <div style={{
          backgroundColor: '#1a1d21', width: '100%', maxWidth: '420px', borderRadius: '24px',
          padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(to right, #e040fb, #8b5cf6)' }}></div>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💸</div>
            <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '4px' }}>Reembolsar Pedido #{reembolsoPedido.numero_pedido}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Selecciona la billetera de destino</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => ejecutarReembolso(reembolsoPedido, 'usd')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderRadius: '16px', border: '2px solid rgba(0, 210, 255, 0.3)',
                backgroundColor: 'rgba(0, 210, 255, 0.05)', cursor: 'pointer', transition: 'all 0.2s ease',
                color: '#fff'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0, 210, 255, 0.3)'; e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.05)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>💵</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Billetera USD</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dólares Americanos</div>
                </div>
              </div>
              <span style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '18px' }}>
                ${Number(reembolsoPedido.total_usd).toFixed(2)}
              </span>
            </button>

            <button
              onClick={() => ejecutarReembolso(reembolsoPedido, 'bs')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderRadius: '16px', border: '2px solid rgba(139, 92, 246, 0.3)',
                backgroundColor: 'rgba(139, 92, 246, 0.05)', cursor: 'pointer', transition: 'all 0.2s ease',
                color: '#fff'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'; e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.05)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🏦</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Billetera Bolívares</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bolívares Venezolanos</div>
                </div>
              </div>
              <span style={{ fontWeight: 800, color: '#a855f7', fontSize: '18px' }}>
                {formatBs(reembolsoPedido.total_bs)}
              </span>
            </button>
          </div>

          <button onClick={() => setShowReembolsoModal(false)} style={{
            width: '100%', marginTop: '20px', padding: '12px', borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}>Cancelar</button>
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
        .select('*, pedido_items(*)')
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

    const { data, error } = await supabase
      .from('pedidos')
      .update({
        atendido_por_id: user.id,
        estado: 'procesando',
        updated_at: new Date().toISOString()
      })
      .eq('id', pedido.id)
      .select('*, pedido_items(*)')
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

  const renderClientModal = () => {
    if (!showClientModal || !modalClient) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease'
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
            <h2 style={{ fontSize: '22px', color: '#fff', marginBottom: '4px' }}>{modalClient.nombres} {modalClient.apellidos}</h2>
            <p style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '14px' }}>@{modalClient.usuario || modalClient.nickname || 'Usuario'}</p>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>📱 WhatsApp</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {modalClient.whatsapp || 'No suministrado'}
                {modalClient.whatsapp && (
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
    const ext = file.name?.split('.').pop() || 'png'
    const fileName = `pedido_${selectedPedido.id}_${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('pedidos-adjuntos')
      .upload(fileName, file, { upsert: true })

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

  // Vista de detalle de un pedido
  if (selectedPedido) {
    const est = getEstadoStyle(selectedPedido.estado)
    return (
      <div style={{ paddingLeft: '16px', paddingBottom: '32px' }}>
        <div className="page-header mb-8 pedidos-header-responsive" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
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
              {!selectedPedido.atendido_por_id ? (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}
                  onClick={() => handleTomarPedido(selectedPedido)}
                >
                  📥 Tomar pedido
                </button>
              ) : selectedPedido.atendido_por_id === user.id && (
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
                  {selectedPedido.pago_verificado === true && !['completado', 'cancelado', 'reembolsado'].includes(selectedPedido.estado) && (
                    <button
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(224, 64, 251, 0.1)', color: '#e040fb', border: '1px solid #e040fb' }}
                      onClick={() => handleReembolsoSelect(selectedPedido)}
                    >
                      💸 Reembolsar
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {renderClientModal()}
        {renderReembolsoModal()}

        <div className="pedidos-grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{selectedPedido.cliente.nombres}</div>
                    <div style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>{selectedPedido.cliente.whatsapp}</div>
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

            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>N° Pedido</span>
                <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '18px' }}>#{selectedPedido.numero_pedido}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Fecha / Hora</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '18px' }}>{formatFecha(selectedPedido.created_at)}</span>
              </div>
              <div style={{ padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Referencia de Pago</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-success)', fontSize: '18px' }}>{selectedPedido.referencia_pago || '-'}</span>
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
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--accent-success)' }}>{formatBs(selectedPedido.total_bs)}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{formatUSD(selectedPedido.total_usd)}</div>
                </div>
              </div>

              {/* Administrador que procesa */}
              {selectedPedido.atendido_por_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {selectedPedido.estado === 'completado' ? '✅ Procesado por' :
                      selectedPedido.estado === 'cancelado' ? '❌ Cancelado por' : '👤 Tomado por'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {selectedPedido.atendido_por_id === user.id ? (perfil.nombres || perfil.usuario || 'Tú') : 'Otro Admin'}
                    </span>

                    {/* Botón Liberar Pedido */}
                    {isAdmin && selectedPedido.atendido_por_id === user.id && selectedPedido.estado === 'procesando' && (
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
                    backgroundColor: 'var(--bg-card)', fontSize: '11px', cursor: 'pointer', flex: 1, textAlign: 'center'
                  }}>
                    📎 Subir/Pegar Captura
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleUploadImage(e.target.files[0]); e.target.value = '' }} />
                  </label>
                  <div onPaste={handlePaste} tabIndex={0} style={{ display: 'none' }} /> {/* Hook para pegar activado globalmente */}
                </div>

                {/* Listado de Capturas */}
                {(() => {
                  const images = selectedPedido.imagenes_adjuntas ? JSON.parse(selectedPedido.imagenes_adjuntas) : []
                  if (images.length === 0) return null
                  return (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {images.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative', minWidth: '60px' }}>
                          <img src={url} alt="Captura" style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                          <button onClick={() => handleRemoveImage(url)} style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontSize: '10px', padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Status Ocupado */}
                {selectedPedido.atendido_por_id && selectedPedido.atendido_por_id !== user.id && (
                  <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', color: 'var(--accent-error)', fontSize: '11px', marginTop: '8px' }}>
                    🚫 En proceso por otro administrador
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items del pedido */}
          <div className="card" style={{ padding: '12px' }}>
            <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase' }}>Paquetes</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {(selectedPedido.pedido_items || []).map((item, idx) => (
                <div key={idx} style={{
                  padding: '10px', backgroundColor: 'var(--bg-card)', borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '20px' }}>{item.producto_nombre}</span>
                    <span style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '18px' }}>{formatBs(item.precio_bs)}</span>
                  </div>
                  <div style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    🎮 {item.juego_nombre} · Cantidad: {item.cantidad}
                  </div>

                  {/* Datos de recarga */}
                  {item.metodo_recarga === 'cuenta_completa' ? (
                    <div style={{ fontSize: '18px', padding: '8px 12px', backgroundColor: 'rgba(0, 210, 255, 0.08)', borderRadius: '8px', marginTop: '8px' }}>
                      <div style={{ color: 'var(--accent-primary)' }}>📧 {item.account_email}</div>
                      <div style={{ color: 'var(--accent-primary)', marginTop: '4px' }}>🔑 {item.account_password}</div>
                    </div>
                  ) : item.metodo_recarga === 'usuario_clave' ? (
                    <div style={{ fontSize: '18px', padding: '8px 12px', backgroundColor: 'rgba(0, 210, 255, 0.08)', borderRadius: '8px', marginTop: '8px' }}>
                      <div style={{ color: 'var(--accent-primary)' }}>👤 {item.account_user}</div>
                      <div style={{ color: 'var(--accent-primary)', marginTop: '4px' }}>🔑 {item.account_password}</div>
                    </div>
                  ) : item.player_id && (
                    <div style={{ fontSize: '18px', padding: '8px 12px', backgroundColor: 'rgba(0, 210, 255, 0.08)', borderRadius: '8px', marginTop: '8px', color: 'var(--accent-primary)' }}>
                      🆔 ID del Jugador: {item.player_id}
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
    <div style={{ paddingLeft: '20px' }}>
      <div className="page-header mb-24">
        <h1 className="page-title">📋 Pedidos</h1>
        <p className="page-subtitle">Gestiona los pedidos realizados por los clientes</p>
      </div>

      {renderAlertModal()}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          Cargando pedidos...
        </div>
      ) : (
        <>
          {/* FILTROS POR ESTADO */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {FILTROS.map(f => {
              const count = f.key === 'todos' ? pedidos.length : pedidos.filter(p => p.estado === f.key).length
              const isActive = filtroEstado === f.key
              const style = f.key !== 'todos' ? getEstadoStyle(f.key) : { bg: 'var(--bg-panel)', color: 'var(--text-primary)' }
              return (
                <button
                  key={f.key}
                  onClick={() => { setFiltroEstado(f.key); setCurrentPage(1); }}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    backgroundColor: isActive ? style.bg : 'var(--bg-card)',
                    color: isActive ? style.color : 'var(--text-muted)',
                    outline: isActive ? `2px solid ${style.color}` : '1px solid var(--border-color)',
                    transition: 'all 0.2s'
                  }}
                >
                  {f.icon} {f.label}
                  <span style={{
                    backgroundColor: isActive ? style.color : 'var(--bg-panel)',
                    color: isActive ? '#111' : 'var(--text-muted)',
                    padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700
                  }}>{count}</span>
                </button>
              )
            })}
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No hay pedidos en esta categoría</h3>
              <p style={{ color: 'var(--text-muted)' }}>Selecciona otra categoría o espera a que se registren nuevos pedidos.</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>N° Pedido</th>
                      <th>Fecha / Hora</th>
                      <th style={{ textAlign: 'left' }}>Cliente</th>
                      <th>Juego(s)</th>
                      <th>Paquetes</th>
                      <th>Referencia</th>
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Responsable</th>
                      <th style={{ textAlign: 'center' }}>Pago</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPedidos.map(pedido => {
                      const est = getEstadoStyle(pedido.estado)
                      const items = pedido.pedido_items || []
                      const juegos = [...new Set(items.map(i => i.juego_nombre))]
                      const paquetes = items.map(i => `${i.producto_nombre}${i.cantidad > 1 ? ` x${i.cantidad}` : ''}`)

                      return (
                        <tr key={pedido.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenPedido(pedido)}>
                          <td style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '15px' }}>
                            #{pedido.numero_pedido}
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {formatFecha(pedido.created_at)}
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {pedido.cliente ?
                              `${pedido.cliente.nombres} ${pedido.cliente.apellidos?.toLowerCase() === 'pendiente' ? '' : (pedido.cliente.apellidos || '')}`.trim() :
                              '-'
                            }
                          </td>
                          <td style={{ fontSize: '13px' }}>
                            {juegos.join(', ')}
                          </td>
                          <td style={{ fontSize: '13px', maxWidth: '200px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {paquetes.join(', ')}
                            </div>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {pedido.referencia_pago || '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-success)' }}>
                            {formatBs(pedido.total_bs)}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '12px', color: pedido.atendido_por_id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {pedido.atendido_por ?
                              `${pedido.atendido_por.nombres} ${pedido.atendido_por.apellidos?.toLowerCase() === 'pendiente' ? '' : (pedido.atendido_por.apellidos || '')}`.trim() :
                              '-'
                            }
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap',
                              backgroundColor: pedido.pago_verificado === true ? 'rgba(34, 197, 94, 0.15)' : pedido.pago_verificado === false ? 'rgba(239, 68, 68, 0.15)' : 'rgba(250, 204, 21, 0.15)',
                              color: pedido.pago_verificado === true ? '#22c55e' : pedido.pago_verificado === false ? '#ef4444' : '#facc15'
                            }}>
                              {pedido.pago_verificado === true ? '✅ Verificado' : pedido.pago_verificado === false ? '❌ Rechazado' : '⏳ Pendiente'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                              backgroundColor: est.bg, color: est.color, fontWeight: 600
                            }}>
                              {est.label}
                            </span>
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '13px' }}>
                              Ver →
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
