import React, { useState, Suspense, lazy } from 'react'
import Layout from './components/Layout'
import Login from './components/Login'
import Register from './components/Register'
import { useAuth, useConfiguracion } from './hooks/useData'

// Componentes estáticos (carga inmediata)
import SupportChat from './components/SupportChat'
import Cart from './components/Cart'
import { Analytics } from "@vercel/analytics/react"

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

export default function App() {
  const { user, perfil, loading, logout, refetch } = useAuth()
  const { config } = useConfiguracion()
  // Usamos localStorage para que no se pierda la sección al cambiar de pestaña
  const [currentPage, setCurrentPage] = useState(localStorage.getItem('lastPage') || 'catalogo')
  const [currentParams, setCurrentParams] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false)

  const handleNavigate = (page, params = null) => {
    setCurrentPage(page)
    setCurrentParams(params)
  }

  // Aplicar favicon
  React.useEffect(() => {
    if (config && config.favicon_url) {
      // Eliminar favicons viejos para evitar conflictos de tipo/MIME
      const existingLinks = document.querySelectorAll("link[rel~='icon']")
      existingLinks.forEach(l => l.parentNode.removeChild(l))

      // Crear el nuevo link
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = config.favicon_url
      // Intentar detectar el tipo por extensión o dejar que el navegador lo maneje
      if (config.favicon_url.toLowerCase().endsWith('.svg')) link.type = 'image/svg+xml'
      else if (config.favicon_url.toLowerCase().endsWith('.png')) link.type = 'image/png'
      else if (config.favicon_url.toLowerCase().endsWith('.ico')) link.type = 'image/x-icon'

      document.head.appendChild(link)
    }
  }, [config?.favicon_url])

  // Guardamos en localStorage cada vez que cambia la página
  React.useEffect(() => {
    localStorage.setItem('lastPage', currentPage)
  }, [currentPage])

  // Solo redirigimos automáticamente la PRIMERA vez que cargamos el perfil
  const hasRedirectedRef = React.useRef(false)
  React.useEffect(() => {
    if (perfil && !hasRedirectedRef.current) {
      if (perfil.rol === 'cliente') {
        setCurrentPage('catalogo')
      } else if (!localStorage.getItem('lastPage')) {
        // Solo enviamos al dashboard al admin si no tiene una página guardada
        setCurrentPage('dashboard')
      }
      hasRedirectedRef.current = true
    }
  }, [perfil])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Iniciando sistema...</p>
      </div>
    )
  }

  // Si hay sesión activa pero el perfil aún no ha cargado desde la BD,
  // mostramos el spinner para evitar la pantalla en blanco.
  if (user && !perfil) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Cargando perfil...</p>
      </div>
    )
  }

  if (!user) {
    return isRegistering
      ? <Register onBackToLogin={() => setIsRegistering(false)} />
      : <Login onGoToRegister={() => setIsRegistering(true)} />
  }

  // Lógica de Estados (Pendiente / Rechazado / Suspendido / Baneado)
  if (perfil?.estado === 'pendiente') return <PendingView onLogout={logout} onRefresh={refetch} />
  if (perfil?.estado === 'rechazado') return <RejectedView onLogout={logout} onRefresh={refetch} />
  if (perfil?.estado === 'suspendido') return <SuspendedView onLogout={logout} onRefresh={refetch} type="suspendido" />
  if (perfil?.estado === 'baneado') return <SuspendedView onLogout={logout} onRefresh={refetch} type="baneado" />

  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'

  const renderPage = () => {
    const fallback = (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Cargando sección...</p>
      </div>
    );

    // Seguridad: Si el usuario NO es admin, solo puede ver catálogo, pedidos, perfil y checkout
    if (user && !isAdmin && !['catalogo', 'perfil', 'pedidos', 'checkout', 'billetera', 'ruleta'].includes(currentPage)) {
      return <Suspense fallback={fallback}><Catalogo /></Suspense>;
    }

    let Content;
    switch (currentPage) {
      case 'dashboard': Content = <Dashboard />; break;
      case 'catalogo': Content = <Catalogo />; break;
      case 'ventas': Content = <RegistroVentas />; break;
      case 'productos': Content = <GestionProductos />; break;
      case 'config': Content = <Configuracion />; break;
      case 'usuarios': Content = <Usuarios onNavigate={handleNavigate} />; break;
      case 'chats':
        const chatKey = currentParams?.targetClientId ? `${currentParams.targetClientId}_${currentParams.prefill}` : 'default';
        Content = <SalaDeChat key={chatKey} perfil={perfil} params={currentParams} />; break;
      case 'pedidos': Content = <Pedidos params={currentParams} onNavigate={handleNavigate} />; break;
      case 'reportes': Content = <Reportes />; break;
      case 'revendedores': Content = <Revendedores onNavigate={handleNavigate} />; break;
      case 'gestion_ruleta': Content = <GestionRuleta />; break;
      case 'ruleta': Content = <Ruleta />; break;
      case 'perfil': Content = <Perfil />; break;
      case 'checkout': Content = <Checkout onFinish={() => setCurrentPage('registro')} />; break;
      case 'billetera': Content = <Billetera onNavigate={handleNavigate} />; break;
      default: Content = <Dashboard />; break;
    }

    return (
      <Suspense fallback={fallback}>
        {Content}
      </Suspense>
    );
  }

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate} onOpenChat={!isAdmin ? () => setIsSupportChatOpen(true) : undefined}>
      {renderPage()}
      <Cart onGoToCheckout={() => handleNavigate('checkout')} />
      {!isAdmin && <SupportChat perfil={perfil} forceOpen={isSupportChatOpen} onClose={() => setIsSupportChatOpen(false)} />}
    </Layout>
  )
}
