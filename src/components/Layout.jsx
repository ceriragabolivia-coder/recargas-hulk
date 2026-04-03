import React, { useState, useEffect, useRef } from 'react' // Actualizado para limpiar caché
import { useAuth, useConfiguracion, useWallet, useMensajesSistema, useNotificacionesPush } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'

const NAV_ITEMS = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'billetera', icon: '💼', label: 'Billetera' },
  { key: 'catalogo', icon: '💰', label: 'Lista de Precios' },
  { key: 'ventas', icon: '🛒', label: 'Registro de Ventas' },
  { key: 'productos', icon: '📦', label: 'Productos' },
  { key: 'pedidos', icon: '📋', label: 'Pedidos' },
  { key: 'usuarios', icon: '👥', label: 'Usuarios' },
  { key: 'revendedores', icon: '⭐', label: 'Revendedores' },
  { key: 'chats', icon: '💬', label: 'Sala de Chat' },
  { key: 'config', icon: '⚙️', label: 'Configuración' },
  { key: 'reportes', icon: '📈', label: 'Reportes' },
  { key: 'cupones', icon: '🎟️', label: 'Gestión Cupones' },
  { key: 'mis_cupones', icon: '🎁', label: 'Mis Promociones' },
  { key: 'perfil', icon: '👤', label: 'Mi Perfil' },
]

const DEFAULT_TASKBAR_ITEMS = [
  { key: 'pagos_pendientes', icon: '💳', label: 'Pagos Pendientes', color: '#ef4444' },
  { key: 'ordenes_pendientes', icon: '📋', label: 'Órdenes Pendientes', color: '#f59e0b' },
  { key: 'recargas_pendientes', icon: '⚡', label: 'Recargas Pendientes', color: '#8b5cf6' },
  { key: 'soporte_pendientes', icon: '💬', label: 'Mensajes de Soporte', color: '#00d2ff' },
  { key: 'usuarios_online', icon: '👥', label: 'Usuarios en Línea', color: '#22c55e' },
]

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log("Audio not supported or blocked by browser policy");
  }
};

function NotificationBar({ counts, onNavigate }) {
  const activeItems = DEFAULT_TASKBAR_ITEMS.filter(item => counts[item.key] > 0)
  if (activeItems.length === 0) return null
  return (
    <div className="notification-bar" style={{ display: 'flex', gap: '8px' }}>
      {activeItems.map(item => (
        <div 
          key={item.key}
          onClick={() => onNavigate(item.key === 'soporte_pendientes' ? 'chats' : 'pedidos', item.key)}
          className="notification-item"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '12px',
            backgroundColor: `${item.color}15`,
            border: `1px solid ${item.color}30`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: item.color
          }}
        >
          <span>{item.icon}</span>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{counts[item.key]}</span>
        </div>
      ))}
    </div>
  )
}

function WalletWidget({ onNavigate }) {
  const { wallet, loading } = useWallet()
  return (
    <div 
      onClick={() => onNavigate('billetera')}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '6px 16px', borderRadius: '14px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        cursor: 'pointer', transition: 'all 0.2s ease',
        marginLeft: '8px'
      }}
      className="wallet-widget-hover"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px' }} title="Billetera Digital">💼</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>USD</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-success)' }}>
              {loading ? '...' : formatUSD(wallet?.saldo || 0)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '12px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bs</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>
              {loading ? '...' : formatBs(wallet?.saldo_bs || 0)}
            </span>
          </div>
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onNavigate('billetera'); }}
        style={{
          width: '24px', height: '24px', borderRadius: '50%',
          backgroundColor: 'var(--accent-primary)', color: 'black',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
          boxShadow: '0 0 10px rgba(0, 210, 255, 0.3)'
        }}
      >
        +
      </button>
    </div>
  )
}

function LiveClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = time.toLocaleDateString('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const timeStr = time.toLocaleTimeString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })

  return (
    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.5px', lineHeight: 1.2 }}>
        {timeStr.toUpperCase()}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 500 }}>
        {dateStr}
      </div>
    </div>
  )
}

export default function Layout({ currentPage, onNavigate, onOpenChat, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar when window resizes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMobileNavigate = (page, params) => {
    onNavigate(page, params)
    setSidebarOpen(false)
  }
  const { user, perfil, logout } = useAuth()
  const { config } = useConfiguracion()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'

  const [counts, setCounts] = useState({
    pagos_pendientes: 0,
    ordenes_pendientes: 0,
    recargas_pendientes: 0,
    soporte_pendientes: 0,
    usuarios_online: 0,
    active_cupones: 0,
  })

  const { mensajes: allMessages } = useMensajesSistema()
  const [activePopup, setActivePopup] = useState(null)
  const [doNotShowAgain, setDoNotShowAgain] = useState(false)

  // Notificaciones en Vivo (Toasts)
  const { fetchNotificacionesActivas } = useNotificacionesPush()
  const [toasts, setToasts] = useState([])
  const [activeNotiDetail, setActiveNotiDetail] = useState(null)
  const userIdRef = useRef(null)

  const adminIdsRef = useRef(new Set())

  const fetchCounts = async () => {
    // 1. Obtener IDs de administradores (solo una vez o según sea necesario)
    if (adminIdsRef.current.size === 0) {
      const { data: adminsData } = await supabase.from('perfiles').select('id').ilike('rol', 'admin')
      const ids = new Set(adminsData?.map(a => a.id) || [])
      if (perfil?.id) ids.add(perfil.id)
      adminIdsRef.current = ids
    }
    const adminIds = adminIdsRef.current

    let pCount = 0, oCount = 0, rCount = 0, sCount = 0

    if (isAdmin) {
      // Usar queries individuales con manejo de errores
      try {
        const { count: p, error: ep } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).is('pago_verificado', null).neq('estado', 'cancelado').neq('estado', 'reembolsado')
        const { count: o, error: eo } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
        const { count: r, error: er } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('pago_verificado', true).neq('estado', 'completado').neq('estado', 'cancelado').neq('estado', 'reembolsado')
        
        if (ep) console.error("Error pCount:", ep)
        if (eo) console.error("Error oCount:", eo)
        if (er) console.error("Error rCount:", er)

        // Recargas de Billetera Pendientes
        const { count: br, error: ebr } = await supabase.from('billetera_recargas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
        if (ebr) console.error("Error brCount:", ebr)

        pCount = p || 0
        oCount = o || 0
        rCount = (r || 0) + (br || 0) // Combinamos pedidos pagados + solicitudes de billetera
      } catch (err) {
        console.error("Error general fetchCounts Pedidos:", err)
      }

      // Chats
      try {
        const { data: messages, error: es } = await supabase.from('soporte_mensajes').select('cliente_id, remitente_id').order('created_at', { ascending: false }).limit(200)
        if (es) console.error("Error soporte:", es)
        if (messages) {
          const latestMap = new Map()
          messages.forEach(m => { if (!latestMap.has(m.cliente_id)) latestMap.set(m.cliente_id, m) })
          
          const potentialClients = []
          latestMap.forEach(m => { if (!adminIds.has(m.remitente_id)) potentialClients.push(m.cliente_id) })
          
          if (potentialClients.length > 0) {
            const { data: clientsData } = await supabase.from('clientes').select('id, soporte_status').in('id', potentialClients)
            if (clientsData) {
              const clientsStatusMap = new Map(clientsData.map(c => [c.id, c.soporte_status]))
              sCount = potentialClients.filter(id => {
                const status = clientsStatusMap.get(id)
                // Filter out if it has 'resuelto' or has no tags (null/empty)
                if (!status || status === 'resuelto') return false
                return true
              }).length
            }
          }
        }
      } catch (err) {
        console.error("Error general fetchCounts Soporte:", err)
      }
    }

    let availableCupones = 0;
    if (!isAdmin && perfil?.id) {
       const { data: cuponesData } = await supabase.from('cupones').select('id, fecha_expiracion, limite_usos, cupones_usados(count)').eq('activo', true)
       if (cuponesData) {
         const { data: misUsos } = await supabase.from('cupones_usados').select('cupon_id').eq('cliente_id', perfil.id)
         const usadosIds = new Set((misUsos || []).map(u => u.cupon_id))
         availableCupones = cuponesData.filter(c => {
           const expired = c.fecha_expiracion && new Date(c.fecha_expiracion) < new Date()
           const exhausted = c.limite_usos && c.cupones_usados?.[0]?.count >= c.limite_usos
           return !expired && !exhausted && !usadosIds.has(c.id)
         }).length
       }
    }

    setCounts({
      pagos_pendientes: pCount,
      ordenes_pendientes: oCount,
      recargas_pendientes: rCount,
      soporte_pendientes: sCount,
      usuarios_online: 0,
      active_cupones: availableCupones
    })
  }

  useEffect(() => {
    fetchCounts()
    const interval = setInterval(fetchCounts, 5000)
    return () => clearInterval(interval)
  }, [perfil?.id, isAdmin])

  // Lógica para mostrar pop-up (Máximo 3 veces, Mute de 24h, Reset por ID)
  useEffect(() => {
    if (allMessages && allMessages.length > 0) {
      const activeOne = allMessages.find(m => m.activo)
      if (activeOne) {
        const id = activeOne.id
        const now = Date.now()
        
        // Verificar si está muteado por 24 horas
        const muteUntil = localStorage.getItem(`popup_muted_until_${id}`)
        if (muteUntil && parseInt(muteUntil) > now) return

        // Verificar contador de vistas (Max 3)
        const viewCount = parseInt(localStorage.getItem(`popup_count_${id}`) || '0')
        if (viewCount >= 3) return

        // Si pasó los filtros, lo mostramos e incrementamos el contador
        // Nota: Solo incrementamos el contador si se muestra realmente
        localStorage.setItem(`popup_count_${id}`, (viewCount + 1).toString())
        setActivePopup(activeOne)
        setDoNotShowAgain(false) // Resetar estado del checkbox
      }
    }
  }, [allMessages])

  const handleClosePopup = () => {
    if (doNotShowAgain && activePopup) {
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000
      localStorage.setItem(`popup_muted_until_${activePopup.id}`, tomorrow.toString())
    }
    setActivePopup(null)
  }

  // Sonido de Campanita (Bell) - respeta política de autoplay del navegador
  const playBellSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const audioCtx = new AudioCtx()
      // Si el contexto está suspendido por política de autoplay, intentar resumirlo
      const tryPlay = () => {
        const playTone = (freq, start, duration, vol) => {
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, start)
          gain.gain.setValueAtTime(vol, start)
          gain.gain.exponentialRampToValueAtTime(0.01, start + duration)
          osc.connect(gain)
          gain.connect(audioCtx.destination)
          osc.start(start)
          osc.stop(start + duration)
        }
        playTone(880, audioCtx.currentTime, 1.5, 0.1)
        playTone(1320, audioCtx.currentTime + 0.1, 1.2, 0.08)
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(tryPlay).catch(() => {})
      } else {
        tryPlay()
      }
    } catch (e) {
      // Silenciosamente ignorar - el sonido es opcional
    }
  }

  // Cargar notificaciones activas al entrar (Historial)  
  // Usando ref para estabilizar el array de dependencias y evitar warning de React
  useEffect(() => {
    userIdRef.current = user?.id || null
  })

  useEffect(() => {
    const loadHistory = async () => {
      const userId = user?.id
      if (!userId) return
      const { data } = await fetchNotificacionesActivas()
      if (data && data.length > 0) {
        const newToasts = data.filter(n => !localStorage.getItem(`noti_seen_${userId}_${n.id}`))
        if (newToasts.length > 0) {
          setToasts(prev => {
            const combined = [...newToasts, ...prev]
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values())
            return unique.slice(0, 3)
          })
        }
      }
    }
    loadHistory()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Suscripción Realtime para Notificaciones Push y Nuevos Pedidos
  useEffect(() => {
    console.log("v2.1 - Sistema de Alertas Listo")
    
    // 1. Suscripción a Notificaciones Genéricas (para todos)
    const channelNotis = supabase
      .channel('notificaciones_clientes_realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notificaciones_clientes' 
      }, payload => {
        const newNoti = payload.new
        if (newNoti) {
          setToasts(prev => [{ ...newNoti, id: Date.now(), db_id: newNoti.id, type: 'push' }, ...prev].slice(0, 3))
          playBellSound()
        }
      })
      .subscribe()

    // 2. Suscripción a Nuevos Pedidos (Solo para Administradores)
    let channelAdminPedidos = null
    let channelAdminBilletera = null
    if (isAdmin) {
      console.log("✅ Suscripción a PEDIDOS (Admin) activa y escuchando...")
      channelAdminPedidos = supabase
        .channel('pedidos_realtime_admin')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos'
        }, payload => {
          console.log("Evento recibido en pedidos (Admin):", payload)
          const newOrder = payload.new
          if (newOrder) {
            const numero = newOrder.numero_pedido || 'N/A'
            const total = Number(newOrder.total_bs || 0).toLocaleString('es-VE')
            const orderToast = {
              id: Date.now() + Math.random(),
              db_id: newOrder.id,
              type: 'new_order',
              titulo: `🚀 ¡NUEVO PEDIDO #${numero}!`,
              mensaje: `Se ha recibido una nueva orden por un total de Bs ${total}. Haz clic para gestionarla.`,
              order_id: newOrder.id
            }
            setToasts(prev => [orderToast, ...prev].slice(0, 3))
            playBellSound()
            fetchCounts()
          }
        })
        .subscribe()

      // 2b. Suscripción a Nuevas SOLICITUDES DE SALDO (Admin)
      console.log("✅ Suscripción a RECARGAS BILLETERA (Admin) activa...")
      channelAdminBilletera = supabase
        .channel('billetera_realtime_admin')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'billetera_recargas'
        }, payload => {
          console.log("Evento recibido en billetera_recargas (Admin):", payload)
          const newRequest = payload.new
          if (newRequest) {
            const montoStr = newRequest.moneda === 'bs' 
              ? (newRequest.monto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + 'Bs')
              : `$${Number(newRequest.monto).toFixed(2)}`
            
            const rechargeToast = {
              id: Date.now() + Math.random(),
              db_id: newRequest.id,
              type: 'new_recharge',
              titulo: `⚡ ¡NUEVA SOLICITUD DE SALDO!`,
              mensaje: `Un usuario solicita recargar ${montoStr} en su billetera. Haz clic para verificar.`,
              target: 'billetera'
            }
            setToasts(prev => [rechargeToast, ...prev].slice(0, 3))
            playBellSound()
            fetchCounts()
          }
        })
      // 2c. Suscripción a CHATS de Soporte (Admin)
      const channelAdminChat = supabase
        .channel('chat_realtime_admin')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'soporte_mensajes'
        }, async payload => {
          console.log("Evento recibido en chat (Admin):", payload)
          const newMsg = payload.new
          // Solo notificar si NO soy yo quien lo envía (es decir, viene del cliente)
          if (newMsg && newMsg.remitente_id !== perfil.cliente_uuid && !newMsg.es_sistema) {
            // Cargar info del cliente para el título del toast
            const { data: cliente } = await supabase.from('clientes').select('nombres').eq('id', newMsg.cliente_id).single()
            
            const chatToast = {
              id: Date.now() + Math.random(),
              db_id: newMsg.id,
              type: 'chat_message', // Reusamos el tipo o creamos admin_chat
              titulo: `💬 Mje de Soporte: ${cliente?.nombres || 'Cliente'}`,
              mensaje: `Se ha recibido un nuevo mensaje de soporte. Haz clic para responder.`,
              target: 'chats'
            }
            setToasts(prev => [chatToast, ...prev].slice(0, 3))
            playBellSound()
            fetchCounts()
          }
        })
        .subscribe()
    }

    // 3. Suscripción a Actualizaciones de Pedidos (Para Clientes/Revendedores)
    let channelUserPedidos = null
    let channelUserBilletera = null
    let channelUserChat = null
    if (!isAdmin && user?.id) {
      console.log(`✅ Escuchando mis pedidos ID: ${user.id}`)
      channelUserPedidos = supabase
        .channel(`user_orders_${user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `cliente_id=eq.${user.id}`
        }, payload => {
          console.log("Evento recibido en pedido de usuario:", payload)
          const updatedOrder = payload.new
          if (updatedOrder) {
            const status = updatedOrder.estado
            if (status === 'completado' || status === 'cancelado') {
              const isSuccess = status === 'completado'
              const numero = updatedOrder.numero_pedido || 'N/A'
              
              const userToast = {
                id: Date.now() + Math.random(),
                db_id: updatedOrder.id,
                type: 'order_update',
                titulo: isSuccess ? `🎉 ¡Pedido #${numero} Listo!` : `❌ Pedido #${numero} Cancelado`,
                mensaje: isSuccess 
                  ? `Tu orden ha sido procesada con éxito. ¡Gracias por confiar en nosotros!` 
                  : `Tu orden ha sido cancelada por la administración. Haz clic para ver detalles.`,
                order_id: updatedOrder.id
              }
              
              setToasts(prev => [userToast, ...prev].slice(0, 3))
              playNotificationSound()
            }
          }
        })
        .subscribe()

      // 3b. Suscripción a Mis Recargas de Billetera (Cliente)
      console.log(`✅ Escuchando mis recargas ID: ${user.id}`)
      channelUserBilletera = supabase
        .channel(`user_recharges_${user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'billetera_recargas',
          filter: `auth_user_id=eq.${user.id}`
        }, payload => {
          console.log("Evento recibido en recarga de usuario:", payload)
          const updatedReq = payload.new
          if (updatedReq && (updatedReq.estado === 'aprobado' || updatedReq.estado === 'rechazado')) {
            const isApproved = updatedReq.estado === 'aprobado'
            const montoStr = updatedReq.moneda === 'bs' 
              ? (updatedReq.monto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + 'Bs')
              : `$${Number(updatedReq.monto).toFixed(2)}`
            
            const userToast = {
              id: Date.now() + Math.random(),
              db_id: updatedReq.id,
              type: 'recharge_update',
              titulo: isApproved ? `✅ ¡Carga de Saldo Aprobada!` : `❌ Carga de Saldo Rechazada`,
              mensaje: isApproved 
                ? `Tu recarga por ${montoStr} ha sido verificada y acreditada con éxito.` 
                : `Tu solicitud de recarga por ${montoStr} no pudo ser aprobada. Revisa los detalles.`,
              target: 'billetera'
            }
            
            setToasts(prev => [userToast, ...prev].slice(0, 3))
            playBellSound()
          }
        })
        .subscribe()

      // 3c. Suscripción a MI CHAT de Soporte (Cliente)
      if (perfil?.cliente_uuid) {
        console.log(`✅ Escuchando mi chat ID: ${perfil.cliente_uuid}`)
        channelUserChat = supabase
          .channel(`user_chat_${perfil.cliente_uuid}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'soporte_mensajes',
            filter: `cliente_id=eq.${perfil.cliente_uuid}`
          }, payload => {
            console.log("Evento recibido en chat de usuario:", payload)
            const newMsg = payload.new
            // Solo notificar si el remitente NO soy yo (es decir, es del admin)
            if (newMsg && newMsg.remitente_id !== perfil.cliente_uuid) {
              const chatToast = {
                id: Date.now() + Math.random(),
                db_id: newMsg.id,
                type: 'chat_message',
                titulo: `💬 ¡MENSAJE DE SOPORTE!`,
                mensaje: `La administración te ha enviado un mensaje. Haz clic para responder.`,
                onAction: onOpenChat // Abrir chat si está definido
              }
              setToasts(prev => [chatToast, ...prev].slice(0, 3))
              playNotificationSound()
            }
          })
          .subscribe()
      }
    }

    return () => {
      if (channelNotis) supabase.removeChannel(channelNotis)
      if (channelAdminPedidos) supabase.removeChannel(channelAdminPedidos)
      if (channelAdminBilletera) supabase.removeChannel(channelAdminBilletera)
      if (channelUserPedidos) supabase.removeChannel(channelUserPedidos)
      if (channelUserBilletera) supabase.removeChannel(channelUserBilletera)
      if (channelUserChat) supabase.removeChannel(channelUserChat)
    }
  }, [isAdmin, user?.id, perfil?.cliente_uuid]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-eliminación de Toasts después de 25 segundos
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(0, prev.length - 1))
      }, 25000) // 25 segundos como solicitó el usuario
      return () => clearTimeout(timer)
    }
  }, [toasts])

  const prevSoporteRef = useRef(0);
  useEffect(() => {
    if (isAdmin && counts.soporte_pendientes > prevSoporteRef.current) {
      playNotificationSound();
    }
    prevSoporteRef.current = counts.soporte_pendientes;
  }, [counts.soporte_pendientes, isAdmin]);

  const renderNavItem = (item) => {
    let label = item.label;
    if (!isAdmin && item.key === 'pedidos') label = 'Mis Pedidos';
    const hasCoupons = item.key === 'mis_cupones' && counts.active_cupones > 0
    const className = `nav-item ${currentPage === item.key ? 'active' : ''} ${hasCoupons ? 'nav-item-promo' : ''}`
    return (
      <div key={item.key} className={className} onClick={() => handleMobileNavigate(item.key)}>
        <span className="nav-item-icon">{item.icon}</span>
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <style>{`
        @keyframes promo-pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 210, 255, 0.4); transform: scale(1); }
          50% { box-shadow: 0 0 20px 5px rgba(0, 210, 255, 0.2); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(0, 210, 255, 0); transform: scale(1); }
        }
        .nav-item-promo:not(.active) {
          border: 1px solid rgba(0, 210, 255, 0.3) !important;
          animation: promo-pulse 2s infinite ease-in-out;
          background: rgba(0, 210, 255, 0.05) !important;
        }
        .nav-item-promo .nav-item-icon { filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5)); }
      `}</style>
      {/* Mobile Sidebar Backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {config?.sidebar_logo_url ? (
            <img src={config.sidebar_logo_url} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
          ) : (
            <div className="sidebar-logo">⚡</div>
          )}
          <div>
            <div className="sidebar-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>{config?.sidebar_title || 'Ceriraga'}</div>
            <div className="sidebar-subtitle">{config?.sidebar_subtitle || 'Centro de Recargas'}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <div className="nav-section-label">Principal</div>
              {NAV_ITEMS.filter(i => ['dashboard', 'billetera', 'catalogo', 'ventas'].includes(i.key)).map(renderNavItem)}
              <div className="nav-section-label">Gestión</div>
              {NAV_ITEMS.filter(i => ['productos', 'pedidos', 'usuarios', 'revendedores', 'chats', 'cupones', 'config'].includes(i.key)).map(renderNavItem)}
              <div className="nav-section-label">Análisis</div>
              {NAV_ITEMS.filter(i => ['reportes'].includes(i.key)).map(renderNavItem)}
              <div className="nav-section-label">Cuenta</div>
              {NAV_ITEMS.filter(i => ['perfil'].includes(i.key)).map(renderNavItem)}
            </>
          ) : (
            <>
              <div className="nav-section-label">Catálogo</div>
              {NAV_ITEMS.filter(item => ['catalogo', 'pedidos', 'mis_cupones'].includes(item.key)).map(renderNavItem)}
              <div className="nav-section-label">Cuenta</div>
              {NAV_ITEMS.filter(i => ['billetera', 'perfil'].includes(i.key)).map(renderNavItem)}
            </>
          )}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, color: 'var(--text-primary)' }}>
                {perfil?.avatar_url ? <img src={perfil.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{user?.email?.[0].toUpperCase()}</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{user?.email?.split('@')[0]}</div>
            </div>
            <button 
              className="btn" 
              onClick={logout} 
              style={{ width: '100%', backgroundColor: 'rgba(255, 82, 82, 0.1)', color: '#ff5252', border: '1px solid rgba(255, 82, 82, 0.2)', justifyContent: 'center' }}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '64px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button className="mobile-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              {sidebarOpen ? '✕' : '☰'}
            </button>
            {config?.mostrar_banner_estado === 'true' && (
              <div className="availability-banner fade-in" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: config?.estado_operativo === 'activo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${config?.estado_operativo === 'activo' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, color: config?.estado_operativo === 'activo' ? '#00ff00' : '#ef4444', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span className={config?.estado_operativo === 'activo' ? 'pulse-animation' : ''} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'currentColor', boxShadow: config?.estado_operativo === 'activo' ? '0 0 10px #00ff00' : 'none' }} />
                <span className="desktop-only">{config?.estado_operativo === 'activo' ? 'Activos' : 'Horario de Descanso'}</span>
              </div>
            )}
            <WalletWidget onNavigate={handleMobileNavigate} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div className="desktop-only"><LiveClock /></div>
            {isAdmin && <NotificationBar key="notif-bar" counts={counts} onNavigate={handleMobileNavigate} />}
          </div>
        </header>
        {children}
      </main>

      {/* MODAL DE MENSAJE DEL SISTEMA (POP-UP) */}
      {activePopup && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 20000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease'
          }}
          onClick={handleClosePopup}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-card)', width: '90%', maxWidth: '500px',
              borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
              position: 'relative', overflow: 'hidden', animation: 'scaleUp 0.3s ease'
            }}
            onClick={e => e.stopPropagation()}
          >
            <style>{`
              @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
            
            <button 
              style={{
                position: 'absolute', top: '16px', right: '16px', borderRadius: '50%',
                width: '32px', height: '32px', backgroundColor: 'rgba(255,255,255,0.05)',
                border: 'none', color: '#fff', cursor: 'pointer', zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
              }}
              onClick={handleClosePopup}
            >✕</button>

            {activePopup.imagen_url && (
              <div style={{ width: '100%', maxHeight: '250px', overflow: 'hidden' }}>
                <img src={activePopup.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ padding: '32px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
                {activePopup.titulo}
              </h2>
              <div 
                style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-line' }}
                dangerouslySetInnerHTML={{ __html: activePopup.contenido }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input 
                  type="checkbox" 
                  id="dont-show-msg"
                  checked={doNotShowAgain}
                  onChange={(e) => setDoNotShowAgain(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="dont-show-msg" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>
                  No volver a mostrar más
                </label>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '48px', fontSize: '16px' }}
                onClick={handleClosePopup}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENEDOR DE NOTIFICACIONES PUSH (TOASTS) - TOP RIGHT */}
      <div style={{
        position: 'fixed', top: '20px', right: '20px', zIndex: 30000,
        display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'none',
        maxWidth: 'calc(100vw - 40px)'
      }}>
        {toasts.map((noti, idx) => (
          <div 
            key={noti.id}
            style={{
              width: '320px', maxWidth: '100%', backgroundColor: 'var(--bg-card)', 
              borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
              display: 'flex', gap: '12px', padding: '16px', pointerEvents: 'auto',
              animation: 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative', overflow: 'hidden', backdropFilter: 'blur(12px)',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (noti.type === 'new_order' || noti.type === 'order_update') {
                onNavigate('pedidos')
              } else if (noti.type === 'new_recharge' || noti.type === 'recharge_update') {
                onNavigate('billetera')
              } else if (noti.type === 'chat_message') {
                if (onOpenChat) onOpenChat()
                else onNavigate(noti.target || 'chats')
              } else {
                setActiveNotiDetail(noti)
                localStorage.setItem(`noti_seen_${user?.id}_${noti.db_id || noti.id}`, 'true')
              }
              setToasts(prev => prev.filter(t => t.id !== noti.id))
            }}
          >
            <style>{`
              @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `}</style>

            {noti.imagen_url && (
              <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                <img src={noti.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {noti.titulo}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {noti.mensaje}
              </div>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation()
                localStorage.setItem(`noti_seen_${user?.id}_${noti.db_id || noti.id}`, 'true')
                setToasts(prev => prev.filter(t => t.id !== noti.id))
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', 
                cursor: 'pointer', padding: '4px', fontSize: '16px'
              }}
            >✕</button>

            {/* Barra de progreso visual para el tiempo (25s) */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: '3px',
              backgroundColor: 'var(--accent-primary)', width: '100%',
              animation: 'shrink 25s linear forwards'
            }}></div>
            <style>{`
              @keyframes shrink { from { width: 100%; } to { width: 0%; } }
            `}</style>
          </div>
        ))}
      </div>

      {/* VENTANA EMERGENTE DETALLADA (MODAL DE AVISO) */}
      {activeNotiDetail && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 40000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease'
          }}
          onClick={() => setActiveNotiDetail(null)}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-card)', width: '95%', maxWidth: '600px',
              borderRadius: '28px', border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8)',
              position: 'relative', overflow: 'hidden', animation: 'scaleUp 0.3s ease'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              style={{
                position: 'absolute', top: '20px', right: '20px', borderRadius: '50%',
                width: '36px', height: '36px', backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
              }}
              onClick={() => setActiveNotiDetail(null)}
            >✕</button>

            {activeNotiDetail.imagen_url && (
              <div style={{ width: '100%', maxHeight: '350px', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <img src={activeNotiDetail.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ padding: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🔔</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Aviso del Sistema
                </span>
              </div>
              
              <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '20px', lineHeight: '1.2' }}>
                {activeNotiDetail.titulo}
              </h2>
              
              <div 
                style={{ fontSize: '17px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '32px', whiteSpace: 'pre-line' }}
                dangerouslySetInnerHTML={{ __html: activeNotiDetail.mensaje }}
              />

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '56px', fontSize: '18px', fontWeight: 800, borderRadius: '16px' }}
                onClick={() => setActiveNotiDetail(null)}
              >
                Cerrar Aviso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
