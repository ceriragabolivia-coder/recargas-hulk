import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth, useConfiguracion, useWallet, useNotificacionesPush, useCart } from '../hooks/useData'
import { playClientOrderSuccessSound } from '../utils/helpers'
import { NavLink, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs, playOrderNotificationSound, hasRole } from '../utils/helpers'
import FloatingBackground from './FloatingBackground'
import DOMPurify from 'dompurify'
import SupportChat from './SupportChat'

const NAV_ITEMS = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard', path: '/Dashboard' },
  { key: 'billetera', icon: '💼', label: 'Billetera', path: '/Billetera' },
  { key: 'catalogo', icon: '💰', label: 'Lista de Precios', path: '/Lista-De-Precios' },
  { key: 'ventas', icon: '🛒', label: 'Registro de Ventas', path: '/Registro-Ventas' },
  { key: 'productos', icon: '📦', label: 'Productos', path: '/Gestion-Productos' },
  { key: 'pedidos', icon: '📋', label: 'Pedidos', path: '/Gestion-Pedidos' }, // Se ajusta dinámicamente en render si es cliente
  { key: 'usuarios', icon: '👥', label: 'Usuarios', path: '/Usuarios' },
  { key: 'revendedores', icon: '⭐', label: 'Revendedores', path: '/Revendedores' },
  { key: 'chats', icon: '💬', label: 'Sala de Chat', path: '/Soporte' },
  { key: 'proveedor_tgv', icon: '📦', label: 'Proveedor API', path: '/Proveedor-TiendaGiftVen' },
  { key: 'config', icon: '⚙️', label: 'Configuración', path: '/Configuracion' },
  { key: 'reportes', icon: '📈', label: 'Reportes', path: '/Reportes' },
  { key: 'pagos_admins', icon: '💸', label: 'Pagos Admins', path: '/Pagos-Admins' },
  { key: 'pagos_bdv', icon: '📱', label: 'Pagos Automáticos', path: '/Pagos-BDV' },
  { key: 'pagos_apk', icon: '📲', label: 'Pagos APK', path: '/Pagos-Apk' },
  { key: 'gestion_socios', icon: '🤝', label: 'Socios y Utilidades', path: '/Gestion-Socios' },
  { key: 'mi_participacion', icon: '🤝', label: 'Mi Participación', path: '/Mi-Participacion' },
  { key: 'estadisticas', icon: '📈', label: 'Estadísticas Pro', path: '/Estadisticas' },
  { key: 'gestion_landing', icon: '🏠', label: 'Gestión Landing', path: '/Gestion-Landing' },
  { key: 'gestion_paginas', icon: '📄', label: 'Páginas del Footer', path: '/Gestion-Paginas' },
  { key: 'gestion_ruleta', icon: '🎡', label: 'Gestión de Ruleta', path: '/Gestion-Ruleta' },
  { key: 'ruleta', icon: '🎡', label: 'Ruleta de Premios', path: '/Ruleta' },
  { key: 'perfil', icon: '👤', label: 'Mi Perfil', path: '/Mi-Perfil' },
]

const DEFAULT_TASKBAR_ITEMS = [
  { key: 'pagos_pendientes', icon: '💳', label: 'Pagos Pendientes', color: '#ef4444' },
  { key: 'ordenes_pendientes', icon: '📋', label: 'Órdenes Pendientes', color: '#f59e0b' },
  { key: 'recargas_pendientes', icon: '⚡', label: 'Recargas de Pedidos', color: '#10b981' },
  { key: 'billetera_pendientes', icon: '💼', label: 'Recargas Billetera', color: '#a855f7' },
  { key: 'soporte_pendientes', icon: '💬', label: 'Mensajes de Soporte', color: '#00d2ff' },
  { key: 'usuarios_online', icon: '👥', label: 'Usuarios en Línea', color: '#22c55e' },
]

// Contexto de audio global para reutilizar recursos
let globalAudioContext = null;
const getAudioContext = () => {
  if (!globalAudioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
};

const playNotificationSound = () => {
  if (localStorage.getItem('admin_sound_enabled') === 'false') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') ctx.resume();

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
    console.log("Audio notification failed:", e);
  }
};

function NotificationBar({ counts, onNavigate, config, onlineUsers, isEmpleado }) {
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowOnlineDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeItems = DEFAULT_TASKBAR_ITEMS.filter(item => {
    if (config[`tb_show_${item.key}`] === 'false') return false
    return counts[item.key] > 0
  })

  if (activeItems.length === 0) return null

  return (
    <div className="notification-bar" style={{ display: 'flex', gap: '8px', position: 'relative' }}>
      {activeItems.map(item => (
        <div 
          key={item.key}
          onClick={(e) => {
            if (item.key === 'usuarios_online') {
              setShowOnlineDropdown(!showOnlineDropdown)
            } else {
              const target = item.key === 'soporte_pendientes' 
                ? 'chats' 
                : item.key === 'billetera_pendientes' 
                  ? 'billetera' 
                  : 'pedidos';
              onNavigate(target, { filterKey: item.key })
            }
          }}
          className="notification-item"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '12px',
            backgroundColor: `${item.color}15`,
            border: `1px solid ${item.color}30`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: item.color,
            position: 'relative'
          }}
        >
          <span>{item.icon}</span>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{counts[item.key]}</span>

          {item.key === 'usuarios_online' && showOnlineDropdown && (
            <div 
              ref={dropdownRef}
              className="glass-morphism"
              style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                backgroundColor: 'rgba(15, 23, 22, 0.98)',
                borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
                zIndex: 99999, padding: '12px',
                animation: 'slideDown 0.2s ease-out'
              }}
              onClick={e => e.stopPropagation()}
            >
              <style>{`
                @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .online-user-item:hover { background: rgba(255, 255, 255, 0.05); }
              `}</style>
              <div style={{ padding: '4px 8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuarios en Línea</span>
                <span style={{ fontSize: '10px', background: 'var(--accent-success)', color: '#000', padding: '2px 8px', borderRadius: '10px', fontWeight: 900 }}>{onlineUsers.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {onlineUsers.map((u, i) => (
                  <div key={i} className="online-user-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '10px', transition: 'all 0.2s' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px', color: '#fff' }}>{u.nickname?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}</span>}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nickname || u.email?.split('@')[0]}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isEmpleado ? '***' : u.email}</div>
                    </div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-success)', boxShadow: '0 0 8px var(--accent-success)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function WalletWidget({ onNavigate }) {
  const { wallet, adminSalesBalance, loading } = useWallet()
  const { perfil, isCliente } = useAuth()
  const isAdmin = hasRole(perfil, 'admin')
  return (
    <div 
      onClick={() => onNavigate('billetera')}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', borderRadius: '14px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-color)',
        cursor: 'pointer', transition: 'all 0.2s ease',
        marginLeft: '4px'
      }}
      className="wallet-widget-hover"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="desktop-only" style={{ fontSize: '18px' }} title="Billetera Digital">💼</span>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* USD balance hidden for Cliente role and hidden on mobile to save space */}
          {!isCliente && (
            <div translate="no" className="desktop-only notranslate" style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isAdmin ? 'Saldo' : 'USD'}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-success)' }}>
                {loading ? '...' : formatUSD(wallet?.saldo || 0)}
              </span>
            </div>
          )}
          <div translate="no" className={!isCliente ? "mobile-no-border-left notranslate" : "notranslate"} style={{ display: 'flex', flexDirection: 'column', borderLeft: !isCliente ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingLeft: !isCliente ? '12px' : '0' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bs</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>
              {loading ? '...' : formatBs(wallet?.saldo_bs || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Saldo Adicional para Administradores (Recaudación de Ventas) */}
      {isAdmin && (
        <div 
          onClick={(e) => { e.stopPropagation(); onNavigate('pagos_admins'); }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', 
            paddingLeft: '12px', marginLeft: '4px',
            borderLeft: '1px solid rgba(255,255,255,0.1)' 
          }}
          title="Ver saldo operativo (recaudación de ventas)"
        >
          <div translate="no" className="notranslate" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '8px', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>OPERATIVO</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-success)' }}>{formatUSD(adminSalesBalance.saldo_usd || 0)}</span>
               <span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7' }}>{formatBs(adminSalesBalance.saldo_bs || 0)}</span>
            </div>
          </div>
          <span style={{ fontSize: '16px' }}>💸</span>
        </div>
      )}

      <button 
        onClick={(e) => { e.stopPropagation(); onNavigate('billetera'); }}
        className="desktop-only"
        style={{
          width: '24px', height: '24px', borderRadius: '50%',
          backgroundColor: 'var(--accent-primary)', color: 'black',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
          boxShadow: '0 0 10px rgba(0, 210, 255, 0.3)',
          marginLeft: '4px'
        }}
      >
        +
      </button>
    </div>
  )
}

function CartWidget() {
  const { totalItems, setIsCartOpen } = useCart()
  
  if (totalItems === 0) return null

  return (
    <div 
      onClick={() => setIsCartOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', borderRadius: '14px',
        backgroundColor: 'rgba(0, 210, 255, 0.1)',
        border: '1px solid rgba(0, 210, 255, 0.3)',
        cursor: 'pointer', transition: 'all 0.2s ease',
        position: 'relative',
        animation: 'bounceIn 0.5s'
      }}
      className="cart-widget-hover"
    >
      <span style={{ fontSize: '18px' }}>🛒</span>
      <span className="badge badge-error" style={{ 
        position: 'absolute', top: '-5px', right: '-5px',
        minWidth: '18px', height: '18px', borderRadius: '9px',
        fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {totalItems}
      </span>
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

export default function Layout({ currentPage, onNavigate, onOpenChat, children, onlineUsers = [] }) {
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
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('admin_sound_enabled') !== 'false')

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('admin_sound_enabled', newVal.toString());
  }
  const isAdmin = hasRole(perfil, 'admin', 'administrador')
  const isNegocio = hasRole(perfil, 'negocio')
  const isEmpleado = hasRole(perfil, 'empleado', 'trabajador')
  const isSocio = hasRole(perfil, 'socio')
  const isRevendedor = hasRole(perfil, 'revendedor')

  const [counts, setCounts] = useState({
    pagos_pendientes: 0,
    ordenes_pendientes: 0,
    recargas_pendientes: 0,
    soporte_pendientes: 0,
    usuarios_online: 0,
  })


  // Notificaciones en Vivo (Toasts)
  const { fetchNotificacionesActivas } = useNotificacionesPush()
  const [toasts, setToasts] = useState([])
  const [activeNotiDetail, setActiveNotiDetail] = useState(null)
  const userIdRef = useRef(null)

  const adminIdsRef = useRef(new Set())

  const fetchCounts = useCallback(async () => {
    // 1. Obtener IDs de administradores (solo una vez o según sea necesario)
    if (adminIdsRef.current.size === 0) {
      const { data: adminsP } = await supabase.from('perfiles').select('id').ilike('rol', 'admin')
      const authIds = adminsP?.map(a => a.id) || []
      
      const { data: adminsC } = await supabase.from('clientes').select('id').in('auth_user_id', authIds)
      const clienteIds = adminsC?.map(c => c.id) || []

      const ids = new Set([...authIds, ...clienteIds])
      if (perfil?.id) ids.add(perfil.id)
      if (perfil?.cliente_uuid) ids.add(perfil.cliente_uuid)
      adminIdsRef.current = ids
    }
    const adminIds = adminIdsRef.current

    let pCount = 0, oCount = 0, rCount = 0, sCount = 0, brCount = 0

    // Solo admins, administradores y negocios ven estos contadores
    if (!isAdmin && !isNegocio) {
      return
    }

    const isSuperAdmin = user?.email?.toLowerCase() === 'recargashulk@gmail.com'
    const ownerId = perfil?.owner_id || (isNegocio ? user?.id : null)

    try {
        let pQuery = supabase.from('pedidos').select('*', { count: 'exact', head: true }).is('pago_verificado', null).neq('estado', 'cancelado').neq('estado', 'reembolsado').neq('estado', 'completado')
        let oQuery = supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
        let rQuery = supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('pago_verificado', true).neq('estado', 'completado').neq('estado', 'cancelado').neq('estado', 'reembolsado')

        if (!isSuperAdmin && ownerId) {
          pQuery = pQuery.eq('owner_id', ownerId)
          oQuery = oQuery.eq('owner_id', ownerId)
          rQuery = rQuery.eq('owner_id', ownerId)
        }

        const [{ count: p, error: ep }, { count: o, error: eo }, { count: r, error: er }] = await Promise.all([
          pQuery, oQuery, rQuery
        ])
        
        if (ep) console.error("Error pCount:", ep)
        if (eo) console.error("Error oCount:", eo)
        if (er) console.error("Error rCount:", er)

        const { count: br, error: ebr } = await supabase.from('billetera_recargas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
        if (ebr) console.error("Error brCount:", ebr)

        pCount = p || 0
        oCount = o || 0
        rCount = r || 0
        brCount = br || 0
      } catch (err) {
        console.error("Error general fetchCounts Pedidos:", err)
      }

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
                if (!status || status === 'resuelto') return false
                return true
              }).length
            }
          }
        }
      } catch (err) {
        console.error("Error general fetchCounts Soporte:", err)
      }

    setCounts(prev => ({
      ...prev,
      pagos_pendientes: pCount,
      ordenes_pendientes: oCount,
      recargas_pendientes: rCount,
      billetera_pendientes: brCount,
      soporte_pendientes: sCount
    }))
  }, [isAdmin, isNegocio, perfil?.id])



  useEffect(() => {
    setCounts(prev => ({ ...prev, usuarios_online: onlineUsers.length }))
  }, [onlineUsers])

  useEffect(() => {
    // Solo ejecutar fetchCounts cuando el perfil está completamente cargado
    if (!perfil?.id) return
    fetchCounts()
    // Polling de respaldo cada 60s (el realtime maneja actualizaciones instantáneas)
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [perfil?.id, isAdmin])


  // Sonido de Campanita (Bell) - respeta política de autoplay del navegador
  const playBellSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

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

      // Check liquidations for admins on login
      if (isAdmin || isNegocio) {
        const { data: liqData } = await supabase.from('admin_saldos_historial')
          .select('*')
          .eq('admin_id', userId)
          .eq('tipo_movimiento', 'liquidacion')
          .order('created_at', { ascending: false })
          .limit(1);

        if (liqData && liqData.length > 0) {
          const liq = liqData[0];
          const seenKey = `liq_seen_${liq.id}`;
          if (!localStorage.getItem(seenKey)) {
            localStorage.setItem(seenKey, 'true');
            
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
              audio.play().catch(e => console.error("No se pudo reproducir sonido de liquidación", e));
            } catch(err) {}

            const montoStr = liq.moneda === 'usd' ? formatUSD(liq.monto) : formatBs(liq.monto);

            if (Notification.permission === 'granted') {
              new Notification('💰 Saldo Liquidado', { body: `Se ha liquidado tu saldo por ${montoStr}.` });
            }

            const toast = {
              id: Date.now() + Math.random(),
              db_id: liq.id,
              type: 'liquidacion',
              titulo: '💰 Saldo Liquidado',
              mensaje: `Se ha liquidado tu saldo por ${montoStr}.`
            };
            setToasts(prev => [toast, ...prev].slice(0, 3));
          }
        }
      }
    }
    loadHistory()
  }, [user?.id, isAdmin, isNegocio]) // eslint-disable-line react-hooks/exhaustive-deps

  // Suscripción Realtime para Notificaciones Push y Nuevos Pedidos
  // Espera a que el perfil esté COMPLETAMENTE cargado para no re-suscribirse
  // múltiples veces durante la carga inicial (isAdmin undefined → false, user?.id undefined → 'xxx')
  const isReady = !!user?.id && perfil !== null && (isAdmin || !!perfil?.cliente_uuid)
  useEffect(() => {
    if (!isReady) return // Salir si aun no está listo el perfil completo
    
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
    let channelAdminNotis = null
    if (isAdmin || isNegocio) {
      console.log("✅ Suscripciones de Admin activas...")
      
      // 2a. Suscripción a Notificaciones de Administración (Nuevos Usuarios, etc.)
      channelAdminNotis = supabase
        .channel('notificaciones_admin_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones_admin'
        }, payload => {
          console.log("Evento recibido en notificaciones_admin:", payload)
          const newNoti = payload.new
          if (newNoti) {
            const adminToast = {
              id: Date.now() + Math.random(),
              db_id: newNoti.id,
              type: newNoti.tipo || 'admin_info',
              titulo: `📢 ${newNoti.titulo}`,
              mensaje: newNoti.mensaje,
              target: newNoti.tipo === 'new_user' ? 'usuarios' : null
            }
            setToasts(prev => [adminToast, ...prev].slice(0, 3))
            playBellSound()
          }
        })
        .subscribe()
      const notifiedAssignments = new Set()
      
      channelAdminPedidos = supabase
        .channel('pedidos_realtime_admin')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pedidos'
        }, payload => {
          console.log("Evento recibido en pedidos (Admin):", payload)
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new
            if (newOrder) {
              // Validar que el pedido sea realmente nuevo (creado hace menos de 2 minutos)
              // Esto evita que actualizaciones de RLS (cuando otro admin procesa) disparen un INSERT
              const orderDate = new Date(newOrder.created_at).getTime()
              const isActuallyNew = (Date.now() - orderDate) < 120000

              if (isActuallyNew) {
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
                playOrderNotificationSound()
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Check if it was assigned to ME and is actively being processed
            if (payload.new && payload.new.atendido_por_id === user?.id && payload.new.estado === 'procesando') {
               // Verify we haven't notified for this specific assignment yet
               const assignKey = `assigned_${payload.new.id}_to_${user?.id}`
               if (!notifiedAssignments.has(assignKey)) {
                 notifiedAssignments.add(assignKey)
                 
                 // Sound
                  try {
                    playOrderNotificationSound();
                  } catch (err) {}
                 
                 // Push Noti
                 if (Notification.permission === 'granted') {
                   new Notification('Nuevo Pedido Asignado', {
                     body: `Se te ha asignado el pedido #${payload.new.numero_pedido || payload.new.id.substring(0,6)}`,
                   });
                 } else if (Notification.permission !== 'denied') {
                   Notification.requestPermission();
                 }

                 // Toast
                 const orderToast = {
                   id: Date.now() + Math.random(),
                   db_id: payload.new.id,
                   type: 'assigned_order',
                   titulo: `👨‍💻 ¡PEDIDO ASIGNADO!`,
                   mensaje: `Se te ha asignado el pedido #${payload.new.numero_pedido || payload.new.id.substring(0,6)}.`,
                   order_id: payload.new.id
                 }
                 setToasts(prev => [orderToast, ...prev].slice(0, 3))
               }
            }
          }
          fetchCounts()
        })
        .subscribe()

      // 2b. Suscripción a Nuevas SOLICITUDES DE SALDO (Admin)
      console.log("✅ Suscripción a RECARGAS BILLETERA (Admin) activa...")
      channelAdminBilletera = supabase
        .channel('billetera_realtime_admin')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'billetera_recargas'
        }, payload => {
          console.log("Evento recibido en billetera_recargas (Admin):", payload)
          if (payload.eventType === 'INSERT') {
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
            }
          }
          fetchCounts()
        })
        .subscribe()

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
          const isFromMe = newMsg.remitente_id === perfil?.id || newMsg.remitente_id === perfil?.cliente_uuid
          const isFromAdmin = adminIdsRef.current.has(newMsg.remitente_id) || isFromMe
          
          if (newMsg && !isFromAdmin && !newMsg.es_sistema) {
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

      // 2d. Suscripción a Liquidaciones Propias (Admin)
      const channelAdminLiq = supabase
        .channel(`liq_realtime_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_saldos_historial',
          filter: `admin_id=eq.${user.id}`
        }, payload => {
          if (payload.new && payload.new.tipo_movimiento === 'liquidacion') {
            const liq = payload.new;
            const seenKey = `liq_seen_${liq.id}`;
            localStorage.setItem(seenKey, 'true');

             try {
               const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
               audio.play().catch(e => console.error("No se pudo reproducir sonido de liquidación", e));
             } catch (err) {}

            const montoStr = liq.moneda === 'usd' ? formatUSD(liq.monto) : formatBs(liq.monto);

            if (Notification.permission === 'granted') {
              new Notification('💰 Saldo Liquidado', { body: `Se ha liquidado tu saldo por ${montoStr}.` });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission();
            }

            const toast = {
              id: Date.now() + Math.random(),
              db_id: liq.id,
              type: 'liquidacion',
              titulo: '💰 Saldo Liquidado',
              mensaje: `Se ha liquidado tu saldo por ${montoStr}.`
            };
            setToasts(prev => [toast, ...prev].slice(0, 3));
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
              if (isSuccess) {
                playClientOrderSuccessSound()
              } else {
                playNotificationSound()
              }
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
      if (channelAdminNotis) supabase.removeChannel(channelAdminNotis)
      if (channelAdminPedidos) supabase.removeChannel(channelAdminPedidos)
      if (channelAdminBilletera) supabase.removeChannel(channelAdminBilletera)
      if (channelUserPedidos) supabase.removeChannel(channelUserPedidos)
      if (channelUserBilletera) supabase.removeChannel(channelUserBilletera)
      if (channelUserChat) supabase.removeChannel(channelUserChat)
      // Remove liq channel if exists
      supabase.getChannels().forEach(ch => {
        if (ch.topic === `realtime:liq_realtime_${user?.id}`) {
          supabase.removeChannel(ch)
        }
      })
    }
  }, [isReady]) // eslint-disable-line react-hooks/exhaustive-deps

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
    let path = item.path;
    if (!isAdmin && !isEmpleado && item.key === 'pedidos') {
      label = 'Mis Pedidos';
      path = '/Mis-Pedidos';
    }
    if (!isAdmin && !isEmpleado && item.key === 'chats') {
      label = 'Chat Con Soporte';
    }
    
    const isCatalogo = item.key === 'catalogo';
    
    return (
      <NavLink 
        key={item.key} 
        to={path} 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={() => {
          setSidebarOpen(false);
          if (isCatalogo) {
            localStorage.removeItem('selectedJuegoId');
            window.dispatchEvent(new Event('reset-catalogo'));
          }
          if (item.key === 'pedidos') {
            window.dispatchEvent(new Event('reset-pedidos'));
          }
        }}
      >
        <span className="nav-item-icon">{item.icon}</span>
        <span>{label}</span>
      </NavLink>
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
        
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
          .mobile-no-border-left { border-left: none !important; padding-left: 0 !important; }
          .wallet-widget-hover { padding: 4px 10px !important; gap: 6px !important; }
          .topbar { padding: 0 12px !important; gap: 4px !important; }
          .notification-bar {
            display: grid !important;
            grid-template-columns: repeat(2, auto) !important;
            gap: 4px !important;
          }
          .notification-item {
            padding: 4px 6px !important;
            gap: 4px !important;
          }
          .notification-item span {
            font-size: 11px !important;
          }
        }
        @media (max-width: 480px) {
          .wallet-widget-hover span:not(.desktop-only) { font-size: 11px !important; }
          .wallet-widget-hover div { gap: 4px !important; }
        }
        .mobile-only { display: none; }
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
            <div className="sidebar-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>{config?.sidebar_title || 'Hulk'}</div>
            <div className="sidebar-subtitle">{config?.sidebar_subtitle || 'Centro de Recargas'}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <div className="nav-section-label">Principal</div>
              {NAV_ITEMS.filter(i => ['dashboard', 'billetera', 'catalogo', 'ventas'].includes(i.key)).map(renderNavItem)}
              <div className="nav-section-label">Gestión</div>
              {NAV_ITEMS.filter(i => ['productos', 'pedidos', 'usuarios', 'revendedores', 'chats', 'proveedor_tgv', 'pagos_admins', 'pagos_apk', 'gestion_socios', 'config', 'gestion_landing', 'gestion_paginas'].includes(i.key)).map(renderNavItem)}
              <div className="nav-section-label">Análisis</div>
              {NAV_ITEMS.filter(i => ['reportes', 'estadisticas', 'gestion_ruleta'].includes(i.key)).map(renderNavItem)}
              <div className="nav-section-label">Cuenta</div>
              {NAV_ITEMS.filter(i => ['perfil'].includes(i.key)).map(renderNavItem)}
            </>
          ) : isNegocio ? (
            <>
              <div className="nav-section-label">Panel de Negocio</div>
              {NAV_ITEMS.filter(item => (perfil.config_modulos || []).includes(item.key) || item.key === 'config').map(renderNavItem)}
              <div className="nav-section-label">Cuenta</div>
              {NAV_ITEMS.filter(i => ['perfil'].includes(i.key)).map(renderNavItem)}
            </>
          ) : isEmpleado ? (
            <>
              <div className="nav-section-label">Gestión Administrativa</div>
              {NAV_ITEMS.filter(item => ['pedidos', 'usuarios', 'chats', 'catalogo'].includes(item.key)).map(renderNavItem)}
              <div className="nav-section-label">Cuenta</div>
              {NAV_ITEMS.filter(i => ['perfil'].includes(i.key)).map(renderNavItem)}
            </>
          ) : isSocio ? (
            <>
              <div className="nav-section-label">Mi Participación</div>
              {NAV_ITEMS.filter(i => ['mi_participacion'].includes(i.key)).map(renderNavItem)}
            </>
          ) : (
            <>
              <div className="nav-section-label">Catálogo</div>
              {NAV_ITEMS.filter(item => ['catalogo', 'pedidos'].includes(item.key)).map(renderNavItem)}
              <div className="nav-section-label">Extras</div>
              {NAV_ITEMS.filter(item => (isRevendedor ? ['chats'] : ['ruleta', 'chats']).includes(item.key)).map(renderNavItem)}
              <div className="nav-section-label">Cuenta</div>
              {NAV_ITEMS.filter(i => ['billetera', 'perfil'].includes(i.key)).map(renderNavItem)}
            </>
          )}
        </nav>

        {/* Botón Descargar App (Visible para todos) */}
        {(config?.apk_url && config?.mostrar_boton_app !== 'false' && config?.mostrar_boton_app !== false) && (
          <div style={{ padding: '0 12px 12px' }}>
             <a 
               href={config.apk_url} 
               download="Hulk.apk"
               className="nav-item nav-item-promo"
               style={{ 
                 textDecoration: 'none', 
                 display: 'flex', 
                 justifyContent: 'center',
                 background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                 color: '#000',
                 fontWeight: 900,
                 fontSize: '13px',
                 borderRadius: '12px',
                 border: 'none',
                 padding: '10px'
               }}
             >
               <span style={{ fontSize: '18px', marginRight: '8px' }}>📲</span>
               DESCARGAR APP
             </a>
          </div>
        )}

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
        <header className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '64px', gap: '8px', position: 'sticky', top: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1000, borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button className="mobile-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              {sidebarOpen ? '✕' : '☰'}
            </button>
            {config?.mostrar_banner_estado === 'true' && (
              <div className="availability-banner fade-in desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: config?.estado_operativo === 'activo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${config?.estado_operativo === 'activo' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, color: config?.estado_operativo === 'activo' ? '#00ff00' : '#ef4444', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span className={config?.estado_operativo === 'activo' ? 'pulse-animation' : ''} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'currentColor', boxShadow: config?.estado_operativo === 'activo' ? '0 0 10px #00ff00' : 'none' }} />
                <span className="desktop-only">{config?.estado_operativo === 'activo' ? 'Activos' : 'Horario de Descanso'}</span>
              </div>
            )}
            <WalletWidget onNavigate={handleMobileNavigate} />
            {(isAdmin || isEmpleado || isNegocio) && (
              <button 
                onClick={toggleSound}
                className="sound-toggle-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 14px', borderRadius: '14px',
                  backgroundColor: soundEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${soundEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: soundEnabled ? '#22c55e' : '#ef4444',
                  cursor: 'pointer', transition: 'all 0.3s ease',
                  fontSize: '11px', fontWeight: 900,
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}
              >
                <span>{soundEnabled ? '🔊' : '🔇'}</span>
                <span className="desktop-only">{soundEnabled ? 'Efectos Activos' : 'Silencio'}</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div className="desktop-only"><LiveClock /></div>
            {isAdmin && <NotificationBar key="notif-bar" counts={counts} onNavigate={handleMobileNavigate} config={config} onlineUsers={onlineUsers} isEmpleado={isEmpleado} />}
            {isEmpleado && <NotificationBar key="notif-bar-emp" counts={counts} onNavigate={handleMobileNavigate} config={config} onlineUsers={onlineUsers} isEmpleado={isEmpleado} />}
            <CartWidget />
          </div>
        </header>
        {children}
      </main>


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
              position: 'relative', overflow: 'hidden',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (noti.type === 'new_order' || noti.type === 'order_update') {
                onNavigate('pedidos', { orderId: noti.order_id || noti.db_id })
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
            padding: '20px', animation: 'fadeIn 0.3s ease'
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
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeNotiDetail.mensaje) }}
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

      {/* CHAT DE SOPORTE PARA CLIENTES (Fuera de la landing) */}
      {perfil && !isAdmin && (
        <SupportChat perfil={perfil} onNavigate={onNavigate} />
      )}
    </div>
  )
}
