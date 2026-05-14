import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './components/Login'
import Register from './components/Register'
import { useAuth, useConfiguracion } from './hooks/useData'
import { WalletProvider } from './context/WalletContext'
import { supabase } from './lib/supabase'

// Componentes estáticos (carga inmediata)
import SupportChat from './components/SupportChat'
import Cart from './components/Cart'
import FloatingBackground from './components/FloatingBackground'
import Landing from './components/Landing'
import kidsGamingImg from './assets/venezuelan_kids_loading.png'
import SystemPopup from './components/SystemPopup'

// Componentes cargados dinámicamente (Lazy Load) para optimizar la velocidad inicial
const Dashboard = lazy(() => import('./components/Dashboard'))
const RegistroVentas = lazy(() => import('./components/RegistroVentas'))
const GestionProductos = lazy(() => import('./components/GestionProductos'))
const Reportes = lazy(() => import('./components/Reportes'))
const Catalogo = lazy(() => import('./components/Catalogo'))
const Perfil = lazy(() => import('./components/Perfil'))
const Configuracion = lazy(() => import('./components/Configuracion'))
const Checkout = lazy(() => import('./components/Checkout'))
const Pedidos = lazy(() => import('./components/Pedidos'))
const Usuarios = lazy(() => import('./components/Usuarios'))
const SalaDeChat = lazy(() => import('./components/SalaDeChat'))
const Billetera = lazy(() => import('./components/Billetera'))
const Revendedores = lazy(() => import('./components/Revendedores'))
const Ruleta = lazy(() => import('./components/Ruleta'))
const GestionRuleta = lazy(() => import('./components/GestionRuleta'))
const PagosAdmins = lazy(() => import('./components/PagosAdmins'))
const Estadisticas = lazy(() => import('./components/Estadisticas.jsx'))
const GestionLanding = lazy(() => import('./components/GestionLanding'))

const Placeholder = ({ title }) => (
  <div className="page-content">
    <div className="card">
      <h2 style={{ color: 'var(--accent-primary)', marginBottom: '16px' }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)' }}>Esta sección llegará pronto...</p>
    </div>
  </div>
)

function ScheduleModal({ show, onClose, config }) {
  const [dontShow, setDontShow] = React.useState(false)
  if (!show) return null
  const horario = config?.horario_atencion_texto || 'Lunes a Domingo: 8:00 AM - 10:00 PM'
  const horarioLines = horario.split(/[|\n]/).map(s => s.trim()).filter(Boolean)

  const handleClose = () => onClose(false)
  const handleEntendido = () => onClose(dontShow)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: '10px',
    }} onClick={handleClose}>
      <style>{`
        @keyframes smFadeIn { from { opacity:0; transform:scale(0.93); } to { opacity:1; transform:scale(1); } }
        .sm-inner { animation: smFadeIn 0.3s ease; max-height: 95vh; overflow-y: auto; }
        .sm-inner::-webkit-scrollbar { width: 4px; }
        .sm-inner::-webkit-scrollbar-thumb { background: rgba(57,255,20,0.4); border-radius: 4px; }
        .sm-checkbox-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .sm-checkbox-box {
          width: 18px; height: 18px; border-radius: 4px; border: 2px solid #39ff14;
          background: transparent; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.2s ease;
        }
        .sm-checkbox-box.checked { background: #39ff14; }
        .sm-checkbox-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.75); line-height: 1.3; }
      `}</style>

      <div
        className="sm-inner"
        style={{
          width: '100%', maxWidth: '420px',
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(57,255,20,0.25), 0 30px 60px rgba(0,0,0,0.7)',
          backgroundColor: '#060608', position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={handleClose} style={{
          position: 'absolute', top: 10, right: 10, zIndex: 20,
          width: 28, height: 28, borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, fontWeight: 'bold',
        }}>✕</button>

        {/* Flyer image with schedule overlay in the RED BOX area */}
        <div style={{ position: 'relative', width: '100%' }}>
          {config?.horario_flyer_url ? (
            <img
              src={config.horario_flyer_url}
              alt="Horario de Atención"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          ) : (
            <div style={{
              padding: '40px', textAlign: 'center',
              background: 'linear-gradient(135deg, #1a0533, #0d0d2b)'
            }}>
              <span style={{ fontSize: 52, display: 'block', marginBottom: 12 }}>⏰</span>
              <p style={{ color: '#39ff14', fontWeight: 900, fontSize: 20 }}>HORARIO PARA RECARGAR:</p>
            </div>
          )}

          {/* Schedule hours overlay — red box area (top-right of flyer) */}
          <div style={{
            position: 'absolute', top: '17%', left: '35%', right: '2%',
            display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch',
          }}>
            {horarioLines.map((line, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(0,0,0,0.72)', border: '2px solid #39ff14',
                borderRadius: 6, padding: '5px 8px', color: '#39ff14',
                fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900,
                fontSize: 'clamp(11px, 3.2vw, 15px)', textAlign: 'center',
                textShadow: '0 0 10px rgba(57,255,20,0.9)', letterSpacing: '0.02em',
                wordBreak: 'break-word', boxShadow: '0 0 8px rgba(57,255,20,0.4)',
              }}>
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Warning section */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0800 0%, #1a0d00 100%)',
          borderTop: '3px solid #ff9900', padding: '12px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>⚠️</span>
          <p style={{
            color: '#ffb347', fontSize: 13, fontWeight: 600,
            lineHeight: 1.5, margin: 0, textShadow: '0 0 8px rgba(255,153,0,0.4)',
          }}>
            Las órdenes creadas fuera del horario establecido se procesarán al siguiente día en el horario laboral.
          </p>
        </div>

        {/* Footer: checkbox + button */}
        <div style={{ padding: '10px 14px 14px', backgroundColor: '#060608', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* "No mostrar por 12h" checkbox */}
          <div
            className="sm-checkbox-row"
            onClick={() => setDontShow(v => !v)}
          >
            <div className={`sm-checkbox-box${dontShow ? ' checked' : ''}`}>
              {dontShow && <span style={{ color: '#000', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </div>
            <span className="sm-checkbox-label">No mostrar por 12 horas</span>
          </div>

          <button onClick={handleEntendido} style={{
            width: '100%', height: 44, fontSize: 15, fontWeight: 800,
            background: 'linear-gradient(90deg, #39ff14, #00d2ff)',
            border: 'none', borderRadius: 10, color: '#000',
            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
            boxShadow: '0 0 20px rgba(57,255,20,0.3)',
          }}>
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  )
}

const PendingView = ({ onLogout, onRefresh }) => (
  <div className="login-container">
    <div className="login-card" style={{ textAlign: 'center', maxWidth: '450px' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
      <h2 className="login-title">Pendiente Por Validar</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
        Tu registro ha sido recibido, Pero Por seguridad debes comunicarte a través de Whatsapp desde el mismo número que usaste para registrarte en la página y de esa manera solicitar la aprobación de tu cuenta y poder acceder a la plataforma.
      </p>

      <div style={{ 
        padding: '16px', 
        backgroundColor: 'rgba(255, 193, 7, 0.1)', 
        borderRadius: '12px', 
        color: '#ffc107', 
        marginBottom: '24px', 
        fontSize: '13px',
        fontWeight: '600',
        lineHeight: '1.5',
        border: '1px solid rgba(255, 193, 7, 0.2)'
      }}>
        Debes solicitar la aprobación de tu cuenta para ingresar a la plataforma, haz click en el botón verde de abajo "Solicitar Aprobación"
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', height: '48px', marginBottom: '12px', fontWeight: '700' }}
        onClick={() => { onRefresh(); setTimeout(() => window.location.reload(), 1500); }}
      >
        🔄 Actualizar
      </button>

      <a
        href="https://api.whatsapp.com/send/?phone=584164287761&text=Hola%2C+quiero+validar+mi+cuenta+en+el+sistema+de+recargas&type=phone_number&app_absent=0"
        target="_blank"
        rel="noopener noreferrer"
        className="btn"
        style={{
          width: '100%',
          height: '48px',
          backgroundColor: '#25D366',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          textDecoration: 'none',
          marginBottom: '16px',
          fontWeight: '700',
          border: 'none',
          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
          fontSize: '15px'
        }}
      >
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.181-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793 0-.853.448-1.273.607-1.446.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.101-.177.211-.077.383.101.173.449.743.964 1.203.664.591 1.221.774 1.394.86.173.088.274.072.376-.043.101-.116.433-.506.548-.68.116-.173.231-.144.39-.087.158.058 1.011.477 1.184.564.173.087.289.129.332.202.043.073.043.419-.101.824z"/>
        </svg>
        Solicitar Aprobación
      </a>

      <button className="btn btn-ghost" style={{ width: '100%', height: '48px' }} onClick={onLogout}>
        Cerrar Sesión
      </button>
    </div>
  </div>
)

const RejectedView = ({ onLogout, onRefresh }) => (
  <div className="login-container">
    <div className="login-card" style={{ textAlign: 'center', maxWidth: '450px' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>❌</div>
      <h2 className="login-title">Acceso Denegado</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
        Lo sentimos, tu solicitud de acceso ha sido rechazada por el administrador.
      </p>

      <button
        className="btn btn-primary"
        style={{ width: '100%', height: '48px', marginBottom: '12px' }}
        onClick={onRefresh}
      >
        🔄 Reintentar Verificación
      </button>

      <button className="btn btn-ghost" style={{ width: '100%', height: '48px' }} onClick={onLogout}>
        Volver
      </button>
    </div>
  </div>
)

const SuspendedView = ({ onLogout, onRefresh, type = 'suspendido' }) => (
  <div className="login-container">
    <div className="login-card" style={{ textAlign: 'center', maxWidth: '450px' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚫</div>
      <h2 className="login-title">{type === 'baneado' ? 'Cuenta Baneada' : 'Cuenta Suspendida'}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
        {type === 'baneado'
          ? 'Tu cuenta ha sido expulsada permanentemente del sistema por incumplir las normas.'
          : 'Tu cuenta ha sido temporalmente suspendida. Por favor, contacta al soporte para más información.'}
      </p>

      <button
        className="btn btn-primary"
        style={{ width: '100%', height: '48px', marginBottom: '12px' }}
        onClick={onRefresh}
      >
        🔄 Verificar Estado
      </button>

      <button className="btn btn-ghost" style={{ width: '100%', height: '48px' }} onClick={onLogout}>
        Cerrar Sesión
      </button>
    </div>
  </div>
)

// Componente de rutas separado para evitar re-montado al cambiar estado de App
const AppRoutes = ({ isAdmin, perfil, currentParams, handleNavigate }) => {
  const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'
  const isEmpleado = perfil?.rol?.toLowerCase() === 'empleado' || perfil?.rol?.toLowerCase() === 'trabajador'
  const fallback = (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Cargando sección...</p>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <Routes>
        {/* Rutas Universales */}
        <Route path="/Lista-De-Precios" element={<Catalogo />} />
        <Route path="/Mi-Perfil" element={<Perfil />} />
        <Route path="/Billetera" element={<Billetera onNavigate={handleNavigate} />} />
        <Route path="/Ruleta" element={<Ruleta />} />
        <Route path="/Checkout" element={<Checkout onFinish={() => window.history.back()} />} />
        <Route path="/Soporte" element={
          (isAdmin || isEmpleado) ? (
            <SalaDeChat 
              key={currentParams?.targetClientId ? `${currentParams.targetClientId}_${currentParams.prefill}` : 'default'} 
              perfil={perfil} 
              params={currentParams} 
              onNavigate={handleNavigate}
            />
          ) : (
            <SupportChat 
              perfil={perfil} 
              isPage={true} 
              onNavigate={handleNavigate} 
            />
          )
        } />
        <Route path="/Mis-Pedidos" element={<Pedidos params={currentParams} onNavigate={handleNavigate} />} />
        <Route path="/Gestion-Pedidos" element={<Pedidos params={currentParams} onNavigate={handleNavigate} />} />

        {/* Rutas Administrativas (Admin y Negocio) */}
        <Route path="/Dashboard" element={(isAdmin || isNegocio || isEmpleado) ? <Dashboard /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Registro-Ventas" element={(isAdmin || isNegocio) ? <RegistroVentas onNavigate={handleNavigate} /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Gestion-Productos" element={(isAdmin || isNegocio) ? <GestionProductos /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Configuracion" element={(isAdmin || isNegocio) ? <Configuracion /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Usuarios" element={(isAdmin || isEmpleado) ? <Usuarios onNavigate={handleNavigate} /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Reportes" element={(isAdmin || isNegocio) ? <Reportes /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Pagos-Admins" element={isAdmin ? <PagosAdmins /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Revendedores" element={isAdmin ? <Revendedores onNavigate={handleNavigate} /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Gestion-Ruleta" element={isAdmin ? <GestionRuleta /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Estadisticas" element={isAdmin ? <Estadisticas /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Gestion-Landing" element={isAdmin ? <GestionLanding /> : <Navigate to="/Lista-De-Precios" replace />} />

        {/* Redirección por defecto */}
        <Route path="/" element={<Navigate to={(isAdmin || isNegocio || isEmpleado) ? "/Dashboard" : "/"} replace />} />
        <Route path="*" element={<Navigate to={(isAdmin || isNegocio || isEmpleado) ? "/Dashboard" : "/"} replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, perfil, loading, logout, refetch } = useAuth()
  const { config, loading: configLoading } = useConfiguracion()
  
  const [currentParams, setCurrentParams] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  
  // Sincronizar isRegistering con la ruta para compatibilidad
  useEffect(() => {
    if (location.pathname === '/register') setIsRegistering(true)
    else if (location.pathname === '/login') setIsRegistering(false)
  }, [location.pathname])

  const currentPage = location.pathname.split('/')[1]?.toLowerCase() || 'catalogo'

  const handleNavigate = (page, params = null) => {
    const pathMap = {
      'dashboard': '/Dashboard',
      'catalogo': '/Lista-De-Precios',
      'ventas': '/Registro-Ventas',
      'productos': '/Gestion-Productos',
      'pedidos': (perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'empleado' || perfil?.rol?.toLowerCase() === 'trabajador') ? '/Gestion-Pedidos' : '/Mis-Pedidos',
      'usuarios': '/Usuarios',
      'chats': '/Soporte',
      'config': '/Configuracion',
      'reportes': '/Reportes',
      'revendedores': '/Revendedores',
      'pagos_admins': '/Pagos-Admins',
      'ruleta': '/Ruleta',
      'gestion_ruleta': '/Gestion-Ruleta',
      'perfil': '/Mi-Perfil',
      'billetera': '/Billetera',
      'estadisticas': '/Estadisticas',
      'gestion_landing': '/Gestion-Landing',
      'checkout': '/Checkout'
    }

    const targetPath = pathMap[page] || `/${page}`
    setCurrentParams(params)
    navigate(targetPath)
  }

  // Aplicar favicon
  React.useEffect(() => {
    if (config?.favicon_url) {
      const existingLinks = document.querySelectorAll("link[rel~='icon']")
      existingLinks.forEach(l => l.parentNode.removeChild(l))
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = config.favicon_url
      document.head.appendChild(link)
    }
  }, [config?.favicon_url])

   // Guardamos en localStorage cada vez que cambia la página
  React.useEffect(() => {
    localStorage.setItem('lastPage', currentPage)
  }, [currentPage])
  
  // Pop-up de Horario: muestra en cada navegación/recarga, salvo supresión de 12h
  const scheduleTimerRef = React.useRef(null)
  useEffect(() => {
    if (!user) return

    // Limpiar timer previo si el usuario navega rápido
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current)
    setShowScheduleModal(false)

    // Verificar supresión de 12 horas
    const suppressKey = `horario_no_mostrar_${user.id}`
    const suppressedUntil = localStorage.getItem(suppressKey)
    if (suppressedUntil && Date.now() < parseInt(suppressedUntil)) return
    // Limpiar la clave si ya expiró
    if (suppressedUntil) localStorage.removeItem(suppressKey)

    const checkAndShowModal = async () => {
      try {
        const { data } = await supabase
          .from('configuracion')
          .select('clave, valor_texto, valor')
          .in('clave', ['show_horario_popup'])
          .is('owner_id', null)

        if (!data || data.length === 0) return
        const row = data.find(r => r.clave === 'show_horario_popup')
        const isEnabled = (row?.valor_texto || String(row?.valor)) === 'true'
        if (!isEnabled) return

        scheduleTimerRef.current = setTimeout(() => {
          setShowScheduleModal(true)
        }, 1500)
      } catch (err) {
        console.error('Error checking schedule modal config:', err)
      }
    }

    checkAndShowModal()
    return () => { if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current) }
  }, [user, location.pathname])

  const handleScheduleModalClose = (dontShow) => {
    setShowScheduleModal(false)
    if (dontShow && user) {
      const suppressUntil = Date.now() + 12 * 60 * 60 * 1000
      localStorage.setItem(`horario_no_mostrar_${user.id}`, suppressUntil.toString())
    }
  }



  // Sistema de Estadísticas: Latido y Actividad
  React.useEffect(() => {
    if (user?.id) {
      const sessionId = Math.random().toString(36).substring(7);
      
      const sendHeartbeat = async (tipo) => {
        try {
          await supabase.rpc('registrar_actividad_usuario', { 
            p_tipo: tipo, 
            p_session_id: sessionId 
          });
        } catch (e) {
          console.debug('HB Error:', e);
        }
      };

      // Registrar inicio
      sendHeartbeat('login');

      // Latido cada 60s
      const interval = setInterval(() => sendHeartbeat('heartbeat'), 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);
 
  const [onlineUsers, setOnlineUsers] = useState([])

  // Presence Tracking Universal (Estabilizado)
  useEffect(() => {
    // Generar o recuperar un ID persistente para la sesión para evitar parpadeos
    let trackId = user?.id;
    if (!trackId) {
      trackId = sessionStorage.getItem('presence_anon_id');
      if (!trackId) {
        trackId = `anon_${Math.random().toString(36).substring(7)}`;
        sessionStorage.setItem('presence_anon_id', trackId);
      }
    }
    
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: trackId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = []
        Object.keys(state).forEach(key => {
          const presence = state[key][0]
          if (presence) users.push(presence)
        })
        setOnlineUsers(users)
        window.dispatchEvent(new CustomEvent('online-users-update', { detail: users.length }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: trackId,
            email: user?.email || 'Visitante',
            nickname: perfil?.nickname || perfil?.nombres || user?.email?.split('@')[0] || 'Visitante',
            avatar_url: perfil?.avatar_url || null,
            role: perfil?.rol || 'visitante',
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // Solo re-suscribir si cambia el ID de usuario o si el perfil (que define nickname/avatar) cambia de nulo a algo
    // Usamos el ID del perfil para evitar re-suscripciones por cambios menores en el objeto perfil
  }, [user?.id, !!perfil])

   const isAdmin = perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'administrador'
  const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'
  const isEmpleado = perfil?.rol?.toLowerCase() === 'empleado' || perfil?.rol?.toLowerCase() === 'trabajador'

  // Solo redirigimos automáticamente la PRIMERA vez que cargamos el perfil
  const hasRedirectedRef = React.useRef(false)
  React.useEffect(() => {
    if (perfil && !hasRedirectedRef.current && (location.pathname === '/login' || location.pathname === '/register')) {
      if (isAdmin || isNegocio || isEmpleado) {
        navigate('/Dashboard', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
      hasRedirectedRef.current = true
    } else if (perfil && !hasRedirectedRef.current && location.pathname === '/') {
      // Si inician sesión desde la Landing, se quedan en la Landing.
      hasRedirectedRef.current = true
    }
  }, [perfil, location.pathname, isAdmin, isNegocio, navigate])

  const [forceLoad, setForceLoad] = useState(false)
  useEffect(() => {
    // Failsafe absoluto: Si después de 6 segundos seguimos en carga, forzamos entrada
    const timer = setTimeout(() => {
      setForceLoad(true)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  // Eliminamos el splash screen global para la Landing Page para que sea instantánea.
  // Los componentes individuales (Landing, Dashboard, etc) ya manejan sus propios estados de carga internos.
  const isLandingPath = location.pathname === '/' || location.pathname === '/index.html' || location.pathname === ''
  
  if (loading && !forceLoad && !user && !isLandingPath) {
    return (
      <div className="loading-screen-modern">
        <img src={kidsGamingImg} alt="Cargando..." className="loading-illustration" width="320" height="320" />
        <div className="loading-text-dynamic">Cargando Sistema</div>
      </div>
    )
  }

  const normalizePath = (p) => p.toLowerCase().replace(/\/+$/, '') || '/'
  const currentPath = normalizePath(location.pathname)
  
  // Rutas base
  const coreLandingRoutes = ['/', '/index.html', '/login', '/register']
  
  // Rutas internas del sistema permitidas para clientes (excluimos checkout para renderizarlo full-screen)
  const clientSystemRoutes = [
    '/lista-de-precios', '/soporte'
  ]

  let isLandingRoute = false
  if (isAdmin || isNegocio) {
    // Admins/Negocio ven Landing solo en las rutas específicas
    isLandingRoute = coreLandingRoutes.includes(currentPath)
  } else if (isEmpleado) {
    // Empleado también ve el sistema por defecto
    isLandingRoute = coreLandingRoutes.includes(currentPath)
  } else {
    // Clientes ven Landing por defecto, A MENOS que estén en una sección del sistema
    isLandingRoute = !clientSystemRoutes.includes(currentPath)
  }

  const mainContent = () => {
    if (!user) {
      const isLandingEnabled = config?.landing_enabled !== '0'
      return (
        <Routes>
          <Route path="/" element={isLandingEnabled ? <Landing /> : <Login onGoToRegister={() => navigate('/register')} />} />
          <Route path="/login" element={<Login onGoToRegister={() => navigate('/register')} />} />
          <Route path="/register" element={<Register onBackToLogin={() => navigate('/login')} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )
    }

    return (
      <WalletProvider>
        {isLandingRoute ? (
          currentPath === '/checkout' ? (
            <Checkout onFinish={() => navigate('/')} />
          ) : (
            <Landing onNavigate={handleNavigate} />
          )
        ) : (
          <>
            <FloatingBackground />
            <Layout currentPage={currentPage} onNavigate={handleNavigate} onOpenChat={() => navigate('/Soporte')} onlineUsers={onlineUsers}>
              <AppRoutes 
                isAdmin={isAdmin} 
                perfil={perfil} 
                currentParams={currentParams} 
                handleNavigate={handleNavigate} 
              />
              <Cart onGoToCheckout={() => navigate('/Checkout')} />
            </Layout>
          </>
        )}
      </WalletProvider>
    )
  }

  return (
    <>
      {mainContent()}
      <SystemPopup />
      <ScheduleModal show={showScheduleModal} onClose={handleScheduleModalClose} config={config} />
    </>
  )
}
