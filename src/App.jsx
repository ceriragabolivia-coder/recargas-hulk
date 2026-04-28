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
import kidsGamingImg from './assets/venezuelan_kids_loading.png'

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

const Placeholder = ({ title }) => (
  <div className="page-content">
    <div className="card">
      <h2 style={{ color: 'var(--accent-primary)', marginBottom: '16px' }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)' }}>Esta sección llegará pronto...</p>
    </div>
  </div>
)

const PendingView = ({ onLogout, onRefresh }) => (
  <div className="login-container">
    <div className="login-card" style={{ textAlign: 'center', maxWidth: '450px' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>⏳</div>
      <h2 className="login-title">Cuenta en Espera</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
        Tu registro ha sido recibido. Por seguridad, un administrador debe aprobar tu cuenta antes de que puedas acceder al catálogo.
      </p>

      <div style={{ padding: '16px', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '12px', color: '#ffc107', marginBottom: '24px', fontSize: '14px' }}>
        🔔 Tu cuenta está siendo revisada por el equipo administrativo.
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', height: '48px', marginBottom: '12px' }}
        onClick={onRefresh}
      >
        🔄 Verificar Estado
      </button>

      <a
        href="https://wa.me/584164287761?text=Hola,%20quiero%20validar%20mi%20cuenta%20en%20el%20sistema%20de%20recargas"
        target="_blank"
        rel="noopener noreferrer"
        className="btn"
        style={{
          width: '100%',
          height: '48px',
          backgroundColor: '#2b2d42',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          textDecoration: 'none',
          marginBottom: '16px',
          fontWeight: '600',
          border: '1px solid #3d405b'
        }}
      >
        <span style={{ fontSize: '20px' }}>💬</span> Solicitar Aprobación
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
          isAdmin ? (
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
        <Route path="/Dashboard" element={(isAdmin || isNegocio) ? <Dashboard /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Registro-Ventas" element={(isAdmin || isNegocio) ? <RegistroVentas onNavigate={handleNavigate} /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Gestion-Productos" element={(isAdmin || isNegocio) ? <GestionProductos /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Configuracion" element={(isAdmin || isNegocio) ? <Configuracion /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Usuarios" element={isAdmin ? <Usuarios onNavigate={handleNavigate} /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Reportes" element={(isAdmin || isNegocio) ? <Reportes /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Pagos-Admins" element={isAdmin ? <PagosAdmins /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Revendedores" element={isAdmin ? <Revendedores onNavigate={handleNavigate} /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Gestion-Ruleta" element={isAdmin ? <GestionRuleta /> : <Navigate to="/Lista-De-Precios" replace />} />
        <Route path="/Estadisticas" element={isAdmin ? <Estadisticas /> : <Navigate to="/Lista-De-Precios" replace />} />

        {/* Redirección por defecto */}
        <Route path="/" element={<Navigate to={(isAdmin || isNegocio) ? "/Dashboard" : "/Lista-De-Precios"} replace />} />
        <Route path="*" element={<Navigate to={(isAdmin || isNegocio) ? "/Dashboard" : "/Lista-De-Precios"} replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, perfil, loading, logout, refetch } = useAuth()
  const { config } = useConfiguracion()
  
  const [currentParams, setCurrentParams] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)

  const currentPage = location.pathname.split('/')[1]?.toLowerCase() || 'catalogo'

  const handleNavigate = (page, params = null) => {
    const pathMap = {
      'dashboard': '/Dashboard',
      'catalogo': '/Lista-De-Precios',
      'ventas': '/Registro-Ventas',
      'productos': '/Gestion-Productos',
      'pedidos': perfil?.rol?.toLowerCase() === 'admin' ? '/Gestion-Pedidos' : '/Mis-Pedidos',
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

  // Sistema de Estadísticas: Latido y Actividad
  React.useEffect(() => {
    if (user && perfil && perfil.estado === 'activo') {
      const sessionId = Math.random().toString(36).substring(7);
      
      // Registrar login inicial (silencioso)
      supabase.rpc('registrar_actividad_usuario', { p_tipo: 'login', p_session_id: sessionId })
        .catch(() => {});

      // Intervalo de latido (cada minuto)
      const interval = setInterval(() => {
        supabase.rpc('registrar_actividad_usuario', { p_tipo: 'heartbeat', p_session_id: sessionId })
          .catch(() => {});
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [user?.id, perfil?.id])

  const isAdmin = perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'administrador'
  const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'

  // Solo redirigimos automáticamente la PRIMERA vez que cargamos el perfil
  const hasRedirectedRef = React.useRef(false)
  React.useEffect(() => {
    if (perfil && !hasRedirectedRef.current && location.pathname === '/') {
      navigate((isAdmin || isNegocio) ? '/Dashboard' : '/Lista-De-Precios', { replace: true })
      hasRedirectedRef.current = true
    }
  }, [perfil, location.pathname, isAdmin, isNegocio])

  const [forceLoad, setForceLoad] = useState(false)
  useEffect(() => {
    // Failsafe absoluto: Si después de 6 segundos seguimos en carga, forzamos entrada
    const timer = setTimeout(() => {
      setForceLoad(true)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  if ((loading || (user && (!perfil || perfil.estado === 'cargando'))) && !forceLoad) {
    return (
      <div className="loading-screen-modern">
        <img src={kidsGamingImg} alt="Cargando..." className="loading-illustration" width="320" height="320" />
        <div className="loading-text-dynamic">Cargando Sistema</div>
      </div>
    )
  }

  if (!user) {
    return isRegistering
      ? <Register onBackToLogin={() => setIsRegistering(false)} />
      : <Login onGoToRegister={() => setIsRegistering(true)} />
  }

  if (perfil?.estado === 'pendiente') return <PendingView onLogout={logout} onRefresh={refetch} />
  if (perfil?.estado === 'rechazado') return <RejectedView onLogout={logout} onRefresh={refetch} />
  if (perfil?.estado === 'suspendido') return <SuspendedView onLogout={logout} onRefresh={refetch} type="suspendido" />
  if (perfil?.estado === 'baneado') return <SuspendedView onLogout={logout} onRefresh={refetch} type="baneado" />

  return (
    <WalletProvider>
      <FloatingBackground />
      <Layout currentPage={currentPage} onNavigate={handleNavigate} onOpenChat={() => navigate('/Soporte')}>
        <AppRoutes 
          isAdmin={isAdmin} 
          perfil={perfil} 
          currentParams={currentParams} 
          handleNavigate={handleNavigate} 
        />
        <Cart onGoToCheckout={() => navigate('/Checkout')} />
      </Layout>
    </WalletProvider>
  )
}
