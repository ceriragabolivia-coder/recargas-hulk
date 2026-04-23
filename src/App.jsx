import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './components/Login'
import Register from './components/Register'
import { useAuth, useConfiguracion } from './hooks/useData'
import { WalletProvider } from './context/WalletContext'

// Componentes estáticos (carga inmediata)
import SupportChat from './components/SupportChat'
import Cart from './components/Cart'
import kidsGamingImg from './assets/kids_gaming_loading.png'

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
  console.log('📦 Renderizando App...');
  const navigate = useNavigate()
  const location = useLocation()
  const { user, perfil, loading, logout, refetch } = useAuth()
  const { config } = useConfiguracion()
  
  const [currentParams, setCurrentParams] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)

  // Sincronizar currentPage con la URL (opcional, pero ayuda a la transición)
  const currentPage = location.pathname.split('/')[1]?.toLowerCase() || 'catalogo'

  const handleNavigate = (page, params = null) => {
    // Si la página viene en formato de ruta interna o URL semántica
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
      'checkout': '/Checkout'
    }

    const targetPath = pathMap[page] || `/${page}`
    setCurrentParams(params)
    navigate(targetPath)
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
    if (perfil && !hasRedirectedRef.current && location.pathname === '/') {
      if (perfil.rol === 'admin') {
        navigate('/Dashboard', { replace: true })
      } else {
        navigate('/Lista-De-Precios', { replace: true })
      }
      hasRedirectedRef.current = true
    }
  }, [perfil, location.pathname])

  // Timeout de seguridad para evitar spinner infinito en producción
  const [forceLoad, setForceLoad] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("⚠️ Sistema tardando demasiado en cargar. Forzando visibilidad...")
        setForceLoad(true)
      }
    }, 4000)
    return () => clearTimeout(timer)
  }, [loading])

  // Watchdog: Si tenemos user pero no perfil después de 2s, intentar refetch manual
  useEffect(() => {
    if (user && !perfil && !loading) {
      const t = setTimeout(() => {
        console.log("🛠️ Watchdog: Intentando recuperación de perfil...");
        refetch();
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [user, perfil, loading, refetch])

  // --- VISTA DE CARGA MODERNA (PRUEBA) ---
  // Para revertir a la clásica, simplemente descomenta el bloque de abajo y comenta este
  if ((loading || (user && (!perfil || perfil.estado === 'cargando'))) && !forceLoad) {
    return (
      <div className="loading-screen-modern">
        <img 
          src={kidsGamingImg} 
          alt="Cargando..." 
          className="loading-illustration" 
          width="320" 
          height="320" 
        />
        <div className="loading-text-dynamic">Cargando Sistema</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '10px' }}>
          Esto puede tardar unos segundos
        </p>
      </div>
    )
  }

  /* 
  // --- VISTA DE CARGA CLÁSICA (REVERSIÓN) ---
  if ((loading || (user && (!perfil || perfil.estado === 'cargando'))) && !forceLoad) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Iniciando sistema...</p>
        <p style={{ fontSize: '0.8rem', marginTop: '10px', opacity: 0.6 }}>Esto puede tardar unos segundos</p>
      </div>
    )
  }
  */

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

  const ProtectedRoute = ({ children }) => {
    if (!isAdmin) return <Navigate to="/Lista-De-Precios" replace />
    return children
  }

  const PageRoutes = () => {
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
          <Route path="/Checkout" element={<Checkout onFinish={() => navigate(-1)} />} />
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

          {/* Rutas Administrativas */}
          <Route path="/Dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/Registro-Ventas" element={<ProtectedRoute><RegistroVentas /></ProtectedRoute>} />
          <Route path="/Gestion-Productos" element={<ProtectedRoute><GestionProductos /></ProtectedRoute>} />
          <Route path="/Configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
          <Route path="/Usuarios" element={<ProtectedRoute><Usuarios onNavigate={handleNavigate} /></ProtectedRoute>} />
          <Route path="/Reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
          <Route path="/Pagos-Admins" element={<ProtectedRoute><PagosAdmins /></ProtectedRoute>} />
          <Route path="/Revendedores" element={<ProtectedRoute><Revendedores onNavigate={handleNavigate} /></ProtectedRoute>} />
          <Route path="/Gestion-Ruleta" element={<ProtectedRoute><GestionRuleta /></ProtectedRoute>} />

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to={isAdmin ? "/Dashboard" : "/Lista-De-Precios"} replace />} />
          <Route path="*" element={<Navigate to={isAdmin ? "/Dashboard" : "/Lista-De-Precios"} replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <WalletProvider>
      <Layout currentPage={currentPage} onNavigate={handleNavigate} onOpenChat={() => navigate('/Soporte')}>
        <PageRoutes />
        <Cart onGoToCheckout={() => navigate('/Checkout')} />
      </Layout>
    </WalletProvider>
  )
}
