import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConfiguracion, useAuth, useCart, useCuentasGuardadas } from '../hooks/useData'
import { formatUSD, formatBs, calcularPrecioVenta } from '../utils/helpers'
import LandingAuthModal from './LandingAuthModal'
import Checkout from './Checkout'

export default function Landing() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { config } = useConfiguracion()
  const { user, perfil, logout } = useAuth()
  const { cart, addToCart, clearCart } = useCart()
  const isRevendedor = user?.role === 'revendedor'
  
  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState('login')

  const [juegos, setJuegos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJuego, setSelectedJuego] = useState(null)
  const [productosJuego, setProductosJuego] = useState([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [currentBanner, setCurrentBanner] = useState(0)
  const [showCheckout, setShowCheckout] = useState(false)

  // Estados de Compra y Carrito
  const { cuentas, guardarCuenta, eliminarCuenta } = useCuentasGuardadas(selectedJuego?.id || null)
  const [buyMode, setBuyMode] = useState('single')
  const [localRechargeData, setLocalRechargeData] = useState({
    player_id: '', zone_id: '', account_email: '', account_password: '', account_user: ''
  })
  const [shouldSaveData, setShouldSaveData] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [pendingItem, setPendingItem] = useState(null)
  const [isVerificando, setIsVerificando] = useState(false)
  const [verificacionResultado, setVerificacionResultado] = useState(null)
  const [addedItem, setAddedItem] = useState(null)
  
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  
  // Notificaciones de Usuario (Pedidos)
  const [notificaciones, setNotificaciones] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotiDropdown, setShowNotiDropdown] = useState(false)
  
  // Modo Nocturno
  const [darkMode, setDarkMode] = useState(true)

  const banners = useMemo(() => {
    if (config?.landing_banners_json) {
      try {
        const parsed = JSON.parse(config.landing_banners_json);
        if (parsed && parsed.length > 0) {
          const activeBanners = parsed.filter(b => b.active !== false);
          return activeBanners.length > 0 ? activeBanners : parsed; // Fallback to all if somehow all are disabled to avoid empty carousel
        }
      } catch (e) {
        console.error("Error parsing landing banners", e);
      }
    }
    // Fallback to legacy config
    return [
      {
        id: 1,
        image: config?.landing_banner_1 || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070',
        title: config?.landing_banner_1_title ?? config?.landing_subtitulo ?? '¡Recargas al Instante!',
        text: config?.landing_banner_1_text ?? 'Seguridad y confianza en cada transacción',
        btnText: config?.landing_banner_1_btn_text ?? 'Empieza ahora',
        url: config?.landing_banner_1_url ?? '/register',
        interval: config?.landing_banner_1_interval || '5'
      },
      {
        id: 2,
        image: config?.landing_banner_2 || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071',
        title: config?.landing_banner_2_title ?? 'Los mejores precios del mercado',
        text: config?.landing_banner_2_text ?? '',
        btnText: config?.landing_banner_2_btn_text ?? 'Empieza ahora',
        url: config?.landing_banner_2_url ?? '/register',
        interval: config?.landing_banner_2_interval || '5'
      },
      {
        id: 3,
        image: config?.landing_banner_3 || 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=2070',
        title: config?.landing_banner_3_title ?? 'Explora nuestro catálogo',
        text: config?.landing_banner_3_text ?? '',
        btnText: config?.landing_banner_3_btn_text ?? 'Empieza ahora',
        url: config?.landing_banner_3_url ?? '/register',
        interval: config?.landing_banner_3_interval || '5'
      }
    ]
  }, [config])

  useEffect(() => {
    localStorage.setItem('landing_dark_mode', darkMode)
  }, [darkMode])

  const handleSelectCuenta = (cuenta) => {
    setLocalRechargeData({
      player_id: cuenta.player_id || '',
      zone_id: cuenta.zone_id || '',
      account_email: cuenta.email || '',
      account_password: cuenta.password || '',
      account_user: cuenta.username || ''
    })
    if (cuenta.player_id !== localRechargeData.player_id) {
      setVerificacionResultado(null)
    }
  }

  const handleVerificarJugador = async () => {
    if (!localRechargeData.player_id.trim()) {
      alert('Por favor introduce primero el ID del jugador.')
      return
    }

    setIsVerificando(true)
    setVerificacionResultado(null)

    const juegoNombreNormalizado = selectedJuego.nombre.toLowerCase().replace(/\s/g, '')
    
    try {
      let url = ''
      if (juegoNombreNormalizado.includes('freefire')) {
        url = `https://tiendagiftven.net/conexion_api/api.php?action=ValidarParametros&id=${localRechargeData.player_id}`
      } else if (juegoNombreNormalizado.includes('bloodstrike')) {
        url = `/proxy/bloodstrike?roleid=${localRechargeData.player_id}&client_type=gameclub`
      }

      const response = await fetch(url)
      const data = await response.json()
      
      if (juegoNombreNormalizado.includes('freefire')) {
        if (data.alerta === 'green') {
          setVerificacionResultado({
            success: true,
            nickname: data.nickname,
            verified_id: localRechargeData.player_id,
            mensaje: data.mensaje
          })
        } else {
          setVerificacionResultado({
            success: false,
            mensaje: data.mensaje || 'Jugador no encontrado'
          })
        }
      } else if (juegoNombreNormalizado.includes('bloodstrike')) {
        if (data.code === "0000" || data.msg === 'success') {
          setVerificacionResultado({
            success: true,
            nickname: data.data?.rolename || 'Jugador Encontrado',
            verified_id: localRechargeData.player_id,
            mensaje: 'ID Verificado exitosamente'
          })
        } else {
          setVerificacionResultado({
            success: false,
            mensaje: data.msg || 'ID de BloodStrike no válido o no encontrado'
          })
        }
      }
    } catch (error) {
      console.error('Error verificando jugador:', error)
      setVerificacionResultado({
        success: false,
        mensaje: 'Error al conectar con la API de verificación'
      })
    } finally {
      setIsVerificando(false)
    }
  }

  const confirmAddToCart = async () => {
    if (!pendingItem) return
    const { p, selectedJuego, finalPrice, localRechargeData } = pendingItem
    
    if (buyMode === 'single') {
      clearCart() // Limpiar carrito antes de compra directa
      addToCart(p, selectedJuego, finalPrice, localRechargeData)

      if (shouldSaveData) {
        await guardarCuenta({
          tipo_dato: selectedJuego.metodo_recarga || 'id',
          player_id: localRechargeData.player_id,
          zone_id: localRechargeData.zone_id,
          email: localRechargeData.account_email,
          password: localRechargeData.account_password,
          username: localRechargeData.account_user,
          nombre_perfil: localRechargeData.player_id || localRechargeData.account_email || localRechargeData.account_user || 'Cuenta'
        })
      }

      setPendingItem(null)
      setShowCheckout(true)
      window.scrollTo(0, 0)
    } else {
      addToCart(p, selectedJuego, finalPrice, localRechargeData)
      
      if (shouldSaveData) {
        await guardarCuenta({
          tipo_dato: selectedJuego.metodo_recarga || 'id',
          player_id: localRechargeData.player_id,
          zone_id: localRechargeData.zone_id,
          email: localRechargeData.account_email,
          password: localRechargeData.account_password,
          username: localRechargeData.account_user,
          nombre_perfil: localRechargeData.player_id || localRechargeData.account_email || localRechargeData.account_user || 'Cuenta'
        })
      }

      setAddedItem(p.id)
      setTimeout(() => setAddedItem(null), 1000)
      setPendingItem(null)
    }
  }

  useEffect(() => {
    async function fetchData() {
      const [jRes, cRes] = await Promise.all([
        supabase.from('juegos')
          .select('*, categorias(nombre)')
          .eq('activo', true)
          .is('owner_id', null)
          .eq('mostrar_en_landing', true)
          .order('orden_landing', { ascending: true })
          .order('nombre'),
        supabase.from('categorias')
          .select('*')
          .eq('activa', true)
          .is('owner_id', null)
          .order('orden')
      ])
      
      if (jRes.data) setJuegos(jRes.data)
      if (cRes.data) setCategorias(cRes.data)
      setLoading(false)
    }
    fetchData()
  }, [])

  // 🔔 Efecto para Cargar Notificaciones y Suscribirse a Realtime
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotis = async () => {
      const { data, error } = await supabase
        .from('notificaciones_usuarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setNotificaciones(data);
        setUnreadCount(data.filter(n => !n.leido).length);
      }
    };

    fetchNotis();

    // Suscripción Realtime
    const channel = supabase
      .channel(`user_notis_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notificaciones_usuarios',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotificaciones(prev => [payload.new, ...prev].slice(0, 10));
        setUnreadCount(count => count + 1);
        // Opcional: Sonido de notificación
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markNotiAsRead = async (id) => {
    const { error } = await supabase
      .from('notificaciones_usuarios')
      .update({ leido: true })
      .eq('id', id);
    
    if (!error) {
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('notificaciones_usuarios')
      .update({ leido: true })
      .eq('user_id', user.id)
      .eq('leido', false);
    
    if (!error) {
      setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (selectedJuego) {
      const fetchProductos = async () => {
        setLoadingProductos(true)
        const { data } = await supabase
          .from('productos')
          .select('*')
          .eq('juego_id', selectedJuego.id)
          .eq('activo', true)
          .order('orden')
        if (data) setProductosJuego(data)
        setLoadingProductos(false)
      }
      fetchProductos()
    }
  }, [selectedJuego])

  useEffect(() => {
    const juegoIdQuery = searchParams.get('juego')
    if (juegos.length > 0 && juegoIdQuery) {
      const found = juegos.find(j => String(j.id) === juegoIdQuery || j.nombre.toLowerCase().replace(/\s+/g, '-') === juegoIdQuery)
      if (found && (!selectedJuego || selectedJuego.id !== found.id)) {
        setSelectedJuego(found)
        window.scrollTo(0, 0)
      }
    } else if (!juegoIdQuery && selectedJuego) {
      setSelectedJuego(null)
    }
  }, [searchParams, juegos, selectedJuego])

  const handleSelectJuego = (juego) => {
    setShowCheckout(false)
    if (juego) {
      setSearchParams({ juego: juego.nombre.toLowerCase().replace(/\s+/g, '-') })
    } else {
      setSearchParams({})
      setSelectedJuego(null)
    }
  }

  useEffect(() => {
    if (banners.length > 0) {
      const currentBannerData = banners[currentBanner];
      if (!currentBannerData) return;
      
      let intervalSecs = parseInt(currentBannerData.interval || '5', 10);
      const ms = isNaN(intervalSecs) || intervalSecs < 1 ? 5000 : intervalSecs * 1000;
      
      const timer = setTimeout(() => {
        setCurrentBanner(prev => (prev + 1) % banners.length)
      }, ms);
      
      return () => clearTimeout(timer);
    }
  }, [banners, currentBanner, config]);

  const filteredJuegos = useMemo(() => {
    return juegos.filter(j => {
      const matchesCategory = activeCategory === 'Todos' || j.categorias?.nombre === activeCategory
      const matchesSearch = j.nombre.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [juegos, activeCategory, search])

  const bestsellers = useMemo(() => {
    if (config?.landing_featured_games) {
      const ids = config.landing_featured_games.split(',').map(id => id.trim())
      return juegos.filter(j => ids.includes(String(j.id)))
    }
    return juegos.slice(0, 12)
  }, [juegos, config])

  if (loading || !config) {
    return (
      <div className="landing-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className={`landing-page ${darkMode ? 'dark' : ''}`}>
      {/* HEADER */}
      <header className="landing-header">
        <div className="landing-container flex items-center justify-between landing-header-inner">
          <div className="flex items-center landing-header-left">
            <div className="landing-logo-container" onClick={() => { handleSelectJuego(null); navigate('/'); }}>
              {config?.landing_logo ? (
                <img src={config.landing_logo} alt="Logo" className="landing-logo-img" />
              ) : (
                <div className="landing-logo-icon">⚡</div>
              )}
              <span className="landing-logo-text">{config?.landing_titulo || 'Ceriraga'}</span>
            </div>
            
            <nav className="landing-nav hidden-mobile">
              <a href="#" className="nav-link active" onClick={(e) => { e.preventDefault(); handleSelectJuego(null); }}>Home</a>
              <div className="nav-dropdown">
                <span className="nav-link">Servicios ▾</span>
                <div className="dropdown-content">
                  {categorias.map(cat => (
                    <a key={cat.id} href="#" onClick={(e) => { e.preventDefault(); setActiveCategory(cat.nombre); handleSelectJuego(null); }}>{cat.nombre}</a>
                  ))}
                </div>
              </div>
              <a href="#" className="nav-link">Cupones</a>
              <a href="#" className="nav-link">Ayuda</a>
            </nav>
          </div>

          <div className="flex items-center landing-header-right">
            {!selectedJuego && (
              <div className="landing-search hidden-mobile">
                <input 
                  type="text" 
                  placeholder="Buscar juegos o servicios..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
            )}
            
            {user && (
              <div 
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                onClick={() => {
                  setShowCheckout(true);
                  setSelectedJuego(null);
                  window.scrollTo(0, 0);
                }}
                title="Ver Carrito"
              >
                <span style={{ fontSize: '24px' }}>🛒</span>
                {cart.length > 0 && (
                  <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    {cart.length}
                  </div>
                )}
              </div>
            )}

            {/* CAMPANA DE NOTIFICACIONES */}
            {user && (
              <div className="nav-dropdown" style={{ position: 'relative' }}>
                <div 
                  className="noti-bell-container" 
                  onClick={() => setShowNotiDropdown(!showNotiDropdown)}
                  style={{ position: 'relative', cursor: 'pointer', fontSize: '22px', padding: '5px' }}
                >
                  🔔
                  {unreadCount > 0 && (
                    <div style={{ position: 'absolute', top: '0', right: '0', background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', border: '2px solid var(--bg-card)' }}>
                      {unreadCount}
                    </div>
                  )}
                </div>
                <div className={`dropdown-content ${showNotiDropdown ? 'show' : ''}`} style={{ right: 0, left: 'auto', width: '300px', maxHeight: '400px', overflowY: 'auto' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px' }}>Notificaciones</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Marcar todas como leídas</button>
                    )}
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {notificaciones.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No tienes notificaciones pendientes</div>
                    ) : notificaciones.map(noti => (
                      <div 
                        key={noti.id} 
                        onClick={() => markNotiAsRead(noti.id)}
                        style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid var(--border)', 
                          backgroundColor: noti.leido ? 'transparent' : 'rgba(0, 210, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!noti.leido && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></div>}
                          {noti.titulo}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{noti.mensaje}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>{new Date(noti.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Mis-Pedidos'); }} style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', textDecoration: 'none' }}>Ver todos mis pedidos</a>
                  </div>
                </div>
              </div>
            )}

            {user ? (
              <div className="nav-dropdown">
                <div className="flex items-center" style={{ gap: '8px', cursor: 'pointer' }}>
                  <div className="user-avatar-small">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden-mobile" style={{ fontWeight: '600' }}>Mi Cuenta ▾</span>
                </div>
                <div className="dropdown-content" style={{ right: 0, left: 'auto' }}>
                  <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Conectado como</div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{user.email}</div>
                  </div>
                  {(user?.role === 'admin' || user?.role === 'negocio' || perfil?.rol === 'admin' || perfil?.rol === 'negocio' || perfil?.rol === 'administrador') && (
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Dashboard') }} style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Panel de Control</a>
                  )}
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Mi-Perfil') }}>Mi Perfil</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Mis-Pedidos') }}>Mis Pedidos</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Billetera') }}>Billetera</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); logout() }} style={{ color: '#ef4444' }}>Cerrar Sesión</a>
                </div>
              </div>
            ) : (
              <div className="flex items-center" style={{ gap: '10px' }}>
                <button className="btn-landing-secondary hidden-mobile" onClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }}>Entrar</button>
                <button className="btn-landing-primary hidden-mobile" onClick={() => { setAuthModalView('register'); setIsAuthModalOpen(true); }}>Registrarse</button>
                <button className="btn-mobile-auth-icon visible-mobile" onClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }} title="Entrar">
                  👤
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="landing-main">
        {/* HERO SLIDER (Global) */}
        {!search.trim() && (
          <section className="landing-hero landing-container">
          <div className="hero-slider">
            {banners.map((banner, idx) => (
              <div 
                key={idx} 
                className={`hero-slide ${idx === currentBanner ? 'active' : ''}`}
                style={{ backgroundImage: `url(${banner.image})` }}
              >
                <div className="hero-content">
                  {banner.title && <h2>{banner.title}</h2>}
                  {banner.text && <p>{banner.text}</p>}
                  {banner.btnText && (
                    <button 
                      className="btn-landing-primary" 
                      onClick={() => {
                        if (banner.url && banner.url.startsWith('http')) {
                          window.location.href = banner.url
                        } else if (banner.url) {
                          navigate(banner.url)
                        }
                      }}
                    >
                      {banner.btnText}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="slider-dots">
              {banners.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`dot ${idx === currentBanner ? 'active' : ''}`}
                  onClick={() => setCurrentBanner(idx)}
                ></span>
              ))}
            </div>
          </div>
        </section>
        )}

        {showCheckout ? (
          <Checkout embedded={true} onFinish={() => setShowCheckout(false)} />
        ) : selectedJuego ? (
          /* VISTA DETALLE DEL JUEGO */
          <div className="landing-container detail-view fade-in">
            <div className="breadcrumb">
              <span onClick={() => handleSelectJuego(null)} style={{ cursor: 'pointer' }}>Home</span> &gt; <span>{selectedJuego.nombre}</span>
            </div>

            <div className="detail-layout">
              {/* SECCIÓN CABECERA */}
              <div className="detail-header-area">
                <div className={`detail-header-card ${selectedJuego.banner_url ? 'has-banner' : ''}`}>
                  {selectedJuego.banner_url ? (
                    <div className="detail-game-banner">
                      <img src={selectedJuego.banner_url} alt={selectedJuego.nombre} />
                    </div>
                  ) : (
                    <img src={selectedJuego.icono_url} alt="" className="detail-header-icon" />
                  )}
                  <div className="detail-header-info">
                    <h1>{selectedJuego.nombre}</h1>
                    <div className="detail-stats">
                      <span className="rating">⭐ 5.0 (200+ Reviews)</span>
                      <span className="sold">🔥 200K+ Sold</span>
                      <span className="badge-secure">✅ Secure</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SIDEBAR DE COMPRA (Aparece antes de precios en móvil) */}
              <aside className="detail-sidebar-area">
                <div className="purchase-card">
                  {user ? (
                    <>
                      <h3>Datos de Recarga</h3>
                      
                      <div className="buy-mode-toggle">
                        <button 
                          onClick={() => setBuyMode('single')}
                          className={buyMode === 'single' ? 'active' : ''}
                        >
                          🛍️ Comprar uno
                        </button>
                        <button 
                          onClick={() => setBuyMode('multiple')}
                          className={buyMode === 'multiple' ? 'active' : ''}
                        >
                          🛒 Comprar varios
                        </button>
                      </div>

                      {/* FORMULARIO DE DATOS */}
                      <div className="card-recharge-info">
                        {selectedJuego.metodo_recarga === 'sin_datos' ? (
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600, margin: 0 }}>⚡ Entrega inmediata</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>No necesitas ingresar ningún dato.</p>
                          </div>
                        ) : selectedJuego.metodo_recarga === 'cuenta_completa' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '12px', marginBottom: '8px' }}>📧 Correo</label>
                              <input 
                                type="email" 
                                className="form-input" 
                                placeholder="ejemplo@correo.com"
                                value={localRechargeData.account_email}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_email: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '12px', marginBottom: '8px' }}>🔑 Contraseña</label>
                              <input 
                                type="password" 
                                className="form-input" 
                                placeholder="********"
                                value={localRechargeData.account_password}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                              />
                            </div>
                          </div>
                        ) : selectedJuego.metodo_recarga === 'usuario_clave' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '12px', marginBottom: '8px' }}>👤 Usuario</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Tu usuario"
                                value={localRechargeData.account_user || ''}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_user: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '12px', marginBottom: '8px' }}>🔑 Contraseña</label>
                              <input 
                                type="password" 
                                className="form-input" 
                                placeholder="********"
                                value={localRechargeData.account_password}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>🆔 ID del Jugador</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Introduce el ID"
                                value={localRechargeData.player_id}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 15);
                                  setLocalRechargeData({...localRechargeData, player_id: val});
                                  if (verificacionResultado) setVerificacionResultado(null);
                                }}
                                style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}
                              />
                            </div>
                            
                            {selectedJuego.metodo_recarga === 'id_zone' && (
                              <div>
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>🆔 Zone ID</label>
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  placeholder="Zone ID"
                                  maxLength={4}
                                  value={localRechargeData.zone_id}
                                  onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                                    setLocalRechargeData({...localRechargeData, zone_id: val});
                                  }}
                                  style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}
                                />
                              </div>
                            )}

                            {(selectedJuego.nombre.toLowerCase().replace(/\s/g, '').includes('freefire') || selectedJuego.nombre.toLowerCase().replace(/\s/g, '').includes('bloodstrike')) && (
                              <div>
                                <button 
                                  className="btn-landing-secondary"
                                  onClick={handleVerificarJugador}
                                  disabled={isVerificando}
                                  style={{ width: '100%', fontSize: '13px', padding: '10px' }}
                                >
                                  {isVerificando ? 'Verificando...' : '👤 Verificar Jugador'}
                                </button>

                                {verificacionResultado && (
                                  <div style={{ 
                                    marginTop: '10px', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold',
                                    backgroundColor: verificacionResultado.success ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                                    color: verificacionResultado.success ? '#00c853' : '#ff5252',
                                    border: `1px solid ${verificacionResultado.success ? '#00c853' : '#ff5252'}`
                                  }}>
                                    {verificacionResultado.success ? `✅ ${verificacionResultado.nickname}` : `❌ ${verificacionResultado.mensaje}`}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Cuentas Guardadas */}
                        {cuentas.length > 0 && (
                          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Cuentas Guardadas</div>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                              {cuentas.map(c => (
                                <div 
                                  key={c.id} onClick={() => handleSelectCuenta(c)}
                                  style={{ padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <span>{c.player_id || c.email || c.username || 'Cuenta'}</span>
                                  <span onClick={(e) => { e.stopPropagation(); if(window.confirm('¿Eliminar?')) eliminarCuenta(c.id); }} style={{ color: '#ff5252', padding: '0 4px' }}>✕</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            id="save-data-checkbox-landing"
                            checked={shouldSaveData}
                            onChange={(e) => setShouldSaveData(e.target.checked)}
                          />
                          <label htmlFor="save-data-checkbox-landing" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Guardar datos</label>
                        </div>
                      </div>

                      <div className="sidebar-buttons">
                        <button className="btn-landing-primary w-full" onClick={() => { setShowCheckout(true); window.scrollTo(0, 0); }}>
                          🛒 Ver Carrito / Pagar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>¿Listo para recargar?</h3>
                      <p>Inicia sesión o crea una cuenta para poder realizar compras y gestionar tus pedidos.</p>
                      <div className="sidebar-buttons">
                        <button className="btn-landing-primary w-full mb-12" onClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }}>
                          🔐 Iniciar Sesión
                        </button>
                        <button className="btn-landing-secondary w-full" onClick={() => { setAuthModalView('register'); setIsAuthModalOpen(true); }}>
                          📝 Registrarse
                        </button>
                      </div>
                    </>
                  )}

                  <div className="sidebar-features">
                    <div className="feature-item">
                      <span>⚡</span>
                      <div>
                        <strong>Entrega Rápida</strong>
                        <small>Promedio de 5-10 minutos</small>
                      </div>
                    </div>
                    <div className="feature-item">
                      <span>🛡️</span>
                      <div>
                        <strong>Compra Segura</strong>
                        <small>Tus datos están protegidos</small>
                      </div>
                    </div>
                    <div className="feature-item">
                      <span>💰</span>
                      <div>
                        <strong>Mejor Tasa</strong>
                        <small>Precios competitivos</small>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              {/* LISTA DE PRECIOS E INFORMACIÓN */}
              <div className="detail-content-area">
                <div className="price-list-section">
                  <h3>Selecciona un paquete</h3>
                  {loadingProductos ? (
                    <div className="spinner"></div>
                  ) : (
                    <div className="products-grid">
                      {productosJuego.map(prod => {
                        const pricing = calcularPrecioVenta(prod, selectedJuego, config)
                        return (
                          <div key={prod.id} className="product-card" onClick={() => {
                            if (!user) {
                              setAuthModalView('login');
                              setIsAuthModalOpen(true);
                              return;
                            }
                            
                            if (selectedJuego.metodo_recarga === 'sin_datos') {
                              // OK
                            } else if (selectedJuego.metodo_recarga === 'cuenta_completa') {
                              if (!localRechargeData.account_email.trim() || !localRechargeData.account_password.trim()) {
                                alert('Por favor introduce el correo y clave arriba primero.')
                                return
                              }
                            } else if (selectedJuego.metodo_recarga === 'usuario_clave') {
                              if (!localRechargeData.account_user?.trim() || !localRechargeData.account_password.trim()) {
                                alert('Por favor introduce el usuario y clave arriba primero.')
                                return
                              }
                            } else {
                              if (!localRechargeData.player_id.trim()) {
                                alert('Por favor introduce el ID arriba primero.')
                                return
                              }
                              const juegoNormalizado = selectedJuego.nombre.toLowerCase().replace(/\s/g, '')
                              if (juegoNormalizado.includes('freefire') || juegoNormalizado.includes('bloodstrike')) {
                                if (!verificacionResultado?.success || verificacionResultado.verified_id !== localRechargeData.player_id) {
                                  alert('Debes verificar el nombre del jugador arriba antes de seleccionar un paquete.')
                                  return
                                }
                              }
                            }
                            
                            const finalPrice = calcularPrecioVenta(prod, selectedJuego, config, perfil)
                            setPendingItem({ p: prod, selectedJuego, finalPrice, localRechargeData })
                          }}>
                            {prod.icono_url && <img src={prod.icono_url} alt="" className="product-icon" />}
                            <div className="product-name">{prod.nombre}</div>
                            <div className="product-price">
                              {isRevendedor ? (
                                <span className="price-primary">{formatUSD(pricing.venta_usd)}</span>
                              ) : (
                                <span className="price-primary">{formatBs(pricing.venta_bs)}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Información / Guías */}
                <div className="info-content-section">
                  <div className="info-tab-header">
                    <h4>Información de {selectedJuego.nombre}</h4>
                  </div>
                  <div className="info-body">
                    {selectedJuego.caracteristicas_nota ? (
                      <div className="rich-text" dangerouslySetInnerHTML={{ __html: selectedJuego.caracteristicas_nota.replace(/\n/g, '<br/>') }} />
                    ) : (
                      <p>Para adquirir recargas de {selectedJuego.nombre}, solo necesitas proporcionar tu ID de jugador. La entrega es inmediata una vez verificado el pago.</p>
                    )}
                    
                    <h5>¿Cómo recargar?</h5>
                    <ul>
                      <li>Selecciona el paquete que deseas adquirir.</li>
                      <li>Inicia sesión o regístrate en nuestra plataforma.</li>
                      <li>Completa el pago mediante tu método favorito (Pago Móvil, Binance, PayPal).</li>
                      <li>¡Listo! Tu recarga llegará en minutos.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VISTA CATALOGO PRINCIPAL */
          <>


            {!search.trim() && (
              <section className="landing-section landing-container">
                <div className="section-header">
                  <h3>Recarga Aquí</h3>
                  <a href="#all-games" className="view-all">Ver todos &gt;</a>
                </div>
                <div className="games-grid">
                  {bestsellers.map(juego => (
                    <GameCard key={juego.id} juego={juego} onSelect={() => handleSelectJuego(juego)} />
                  ))}
                </div>
              </section>
            )}

            {/* ALL GAMES / CATEGORIES */}
            <section id="all-games" className="landing-section landing-container" style={{ marginTop: search.trim() ? '20px' : undefined }}>
              <div className="section-header">
                <h3>Explorar Catálogo</h3>
              </div>
              <div className="category-pills">
                <button 
                  className={`pill ${activeCategory === 'Todos' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('Todos')}
                >
                  Todos
                </button>
                {categorias.map(cat => (
                  <button 
                    key={cat.id} 
                    className={`pill ${activeCategory === cat.nombre ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat.nombre)}
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>
              <div className="games-grid">
                {filteredJuegos.map(juego => (
                  <GameCard key={juego.id} juego={juego} onSelect={() => handleSelectJuego(juego)} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="landing-footer">
        <div className="landing-container footer-content">
          <div className="footer-brand">
            <div className="landing-logo-container" onClick={() => handleSelectJuego(null)}>
              {config?.landing_logo ? (
                <img src={config.landing_logo} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }} />
              ) : (
                <div className="landing-logo-icon">⚡</div>
              )}
              <span className="landing-logo-text">{config?.landing_titulo || 'Ceriraga'}</span>
            </div>
            <p>Tu plataforma líder en recargas y servicios digitales en Venezuela. Seguridad, rapidez y los mejores precios.</p>
          </div>
          <div className="footer-links">
            <h4>Empresa</h4>
            <a href="#">Nosotros</a>
            <a href="#">Términos y Condiciones</a>
            <a href="#">Privacidad</a>
          </div>
          <div className="footer-links">
            <h4>Soporte</h4>
            <a href="#">Preguntas Frecuentes</a>
            <a href="#">Contacto WhatsApp</a>
            <a href="#">Estado del Sistema</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 Ceriraga. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* MODAL DE CONFIRMACIÓN DE COMPRA (pendingItem) */}
      {pendingItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s', padding: '16px', backdropFilter: 'blur(5px)'
        }} onClick={() => setPendingItem(null)}>
          <div style={{
            backgroundColor: 'var(--bg-panel)', width: '100%', maxWidth: '420px',
            borderRadius: '24px', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.8)', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)', animation: 'scaleUp 0.3s'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🛒</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>Confirmar {buyMode === 'single' ? 'Compra' : 'Paquete'}</span>
              </div>
              <button 
                onClick={() => setPendingItem(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {pendingItem.p.icono_url ? (
                  <img src={pendingItem.p.icono_url} alt="" style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
                ) : (
                  <div style={{ fontSize: '48px' }}>💎</div>
                )}
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{pendingItem.p.nombre}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent)' }}>{formatBs(pendingItem.finalPrice.venta_bs)}</div>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Datos de Recarga</h4>
                
                {pendingItem.selectedJuego.metodo_recarga === 'sin_datos' ? (
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>⚡ Entrega Inmediata (Sin Datos)</div>
                ) : pendingItem.selectedJuego.metodo_recarga === 'cuenta_completa' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Correo:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.account_email}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Clave:</span> <strong style={{ color: '#fff' }}>••••••••</strong></div>
                  </>
                ) : pendingItem.selectedJuego.metodo_recarga === 'usuario_clave' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Usuario:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.account_user}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Clave:</span> <strong style={{ color: '#fff' }}>••••••••</strong></div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Player ID:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.player_id}</strong></div>
                    {pendingItem.selectedJuego.metodo_recarga === 'id_zone' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Zone ID:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.zone_id}</strong></div>
                    )}
                    {verificacionResultado?.success && verificacionResultado.verified_id === pendingItem.localRechargeData.player_id && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Nombre:</span> <strong style={{ color: '#00c853' }}>{verificacionResultado.nickname}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setPendingItem(null)} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
              >Cancelar</button>
              <button 
                onClick={confirmAddToCart} 
                style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--accent)', color: '#000', fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 210, 255, 0.3)' }}
              >
                {buyMode === 'single' ? 'Pagar Ahora 🚀' : 'Añadir al Carrito 🛒'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICACIÓN DE ITEM AÑADIDO (addedItem) */}
      {addedItem && (
        <div style={{
          position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#00c853', color: '#fff', padding: '12px 24px',
          borderRadius: '30px', fontWeight: 'bold', fontSize: '14px',
          boxShadow: '0 10px 30px rgba(0,200,83,0.4)', zIndex: 10001,
          animation: 'slideUpFade 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span style={{ fontSize: '18px' }}>✨</span> Paquete añadido al carrito
        </div>
      )}

      {/* AUTH MODAL */}
      <LandingAuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialView={authModalView} 
      />

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-page: #f8f9fa;
          --bg-card: #ffffff;
          --bg-header: #ffffff;
          --text-main: #1a1d21;
          --text-muted: #4a5568;
          --border: #e2e8f0;
          --bg-hover: #f7fafc;
          --accent: #7b2ff7;
          --accent-light: rgba(123, 47, 247, 0.1);
        }

        .dark {
          --bg-page: #0f172a;
          --bg-card: #1e293b;
          --bg-header: #1e293b;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --border: #334155;
          --bg-hover: #334155;
        }

        .landing-page {
          background-color: var(--bg-page);
          color: var(--text-main);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
          transition: background-color 0.3s, color 0.3s;
        }
        .landing-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .landing-header {
          background: var(--bg-header);
          height: 80px;
          display: flex;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          border-bottom: 1px solid var(--border);
        }
        .landing-logo-container {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .landing-logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #00d2ff, var(--accent));
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        .landing-logo-text {
          font-size: 22px;
          font-weight: 800;
          background: linear-gradient(135deg, #00d2ff, var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          white-space: nowrap;
          transition: font-size 0.2s;
        }
        .landing-header-inner {
          gap: 40px;
        }
        .landing-header-left {
          gap: 40px;
        }
        .landing-header-right {
          gap: 24px;
        }
        .landing-logo-img {
          width: 40px; 
          height: 40px; 
          border-radius: 10px; 
          object-fit: contain;
          transition: width 0.2s, height 0.2s;
        }
        .user-avatar-small {
          width: 36px; 
          height: 36px; 
          border-radius: 50%; 
          background: var(--accent); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          color: white; 
          font-weight: bold;
        }
        .visible-mobile { display: none; }
        .btn-mobile-auth-icon {
          background: var(--accent);
          color: white;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(123, 47, 247, 0.3);
        }
        .landing-nav {
          display: flex;
          gap: 24px;
        }
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
        }
        .nav-link:hover, .nav-link.active {
          color: var(--accent);
        }
        .nav-dropdown {
          position: relative;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background: var(--bg-card);
          min-width: 200px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-radius: 8px;
          padding: 8px 0;
          z-index: 100;
          border: 1px solid var(--border);
        }
        .nav-dropdown:hover .dropdown-content {
          display: block;
        }
        .dropdown-content a {
          display: block;
          padding: 10px 20px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
        }
        .dropdown-content a:hover {
          background: var(--bg-hover);
          color: var(--accent);
        }
        .landing-search {
          position: relative;
          width: 300px;
        }
        .landing-search input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg-hover);
          color: var(--text-main);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .landing-search input:focus {
          border-color: var(--accent);
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        
        .btn-theme-toggle {
          background: var(--bg-hover);
          border: 1px solid var(--border);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          transition: transform 0.2s;
        }
        .btn-theme-toggle:hover {
          transform: scale(1.1);
        }

        .btn-landing-primary {
          background: var(--accent);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }
        .btn-landing-primary:hover {
          background: #6b21e8;
          transform: translateY(-1px);
        }
        .btn-landing-secondary {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border);
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-landing-secondary:hover {
          background: var(--bg-hover);
        }
        
        .landing-main {
          padding: 20px 0;
          min-height: 600px;
        }
        .hero-slider {
          height: 320px;
          border-radius: 24px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .hero-slide {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background-size: cover;
          background-position: center;
          opacity: 0;
          transition: opacity 0.8s ease;
        }
        .hero-slide.active {
          opacity: 1;
        }
        .hero-slide::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          /* background: linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 60%); Removed overlay to show original image */
          z-index: 1;
        }
        .hero-content {
          position: absolute;
          bottom: 40px;
          left: 60px;
          z-index: 2;
          color: white;
          max-width: 500px;
        }
        .hero-content h2 {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 16px;
          line-height: 1.2;
        }
        .hero-content p {
          font-size: 18px;
          margin-bottom: 32px;
          opacity: 0.9;
        }
        .slider-dots {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 10;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          cursor: pointer;
        }
        .dot.active {
          background: white;
          width: 30px;
          border-radius: 5px;
        }

        .landing-section {
          margin-top: 30px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .section-header h3 {
          font-size: 28px;
          font-weight: 700;
        }
        .view-all {
          color: var(--accent);
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
        }
        .game-card {
          background: var(--bg-card);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          transition: transform 0.3s, box-shadow 0.3s;
          cursor: pointer;
          position: relative;
          border: 1px solid var(--border);
        }
        .game-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
          border-color: var(--accent);
        }
        .game-image {
          width: 100%;
          aspect-ratio: 1/1;
          object-fit: cover;
        }
        .game-info {
          padding: 10px 12px 6px;
        }
        .game-name {
          font-weight: 600;
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }
        .game-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .rating {
          color: #f59e0b;
          font-weight: 700;
        }
        .badge-discount {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #ff6b6b;
          color: white;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 6px;
          z-index: 5;
        }

        .category-pills {
          display: flex;
          gap: 12px;
          margin-bottom: 30px;
          overflow-x: auto;
          padding-bottom: 10px;
        }
        .pill {
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 8px 20px;
          border-radius: 20px;
          white-space: nowrap;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          color: var(--text-main);
        }
        .pill.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        /* DETAIL VIEW STYLES */
        .detail-view {
          margin-top: 20px;
        }
        .breadcrumb {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 24px;
        }
        .breadcrumb span {
          cursor: pointer;
        }
        .breadcrumb span:hover {
          color: var(--accent);
        }
        .detail-layout {
          display: grid;
          grid-template-columns: 1fr 350px;
          grid-template-areas: 
            "header  sidebar"
            "content sidebar";
          gap: 30px;
        }
        .detail-header-area { grid-area: header; }
        .detail-sidebar-area { grid-area: sidebar; }
        .detail-content-area { grid-area: content; }

        .detail-header-card {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 20px;
          display: flex;
          gap: 24px;
          align-items: center;
          margin-bottom: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid var(--border);
        }
        .detail-header-card.has-banner {
          display: block;
          padding: 0;
          overflow: hidden;
        }
        .detail-header-card.has-banner .detail-header-info {
          padding: 24px;
        }
        .detail-game-banner {
          width: 100%;
          aspect-ratio: 3.5 / 1;
          border-radius: 20px;
          overflow: hidden;
          background: #000;
          display: block;
        }
        .detail-game-banner img {
          width: 100%;
          height: 100%;
          object-fit: fill;
        }
        .detail-header-icon {
          width: 100px;
          height: 100px;
          border-radius: 20px;
          object-fit: cover;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        .detail-header-info h1 {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 10px;
        }
        .detail-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          align-items: center;
        }
        .badge-secure {
          background: var(--accent-light);
          color: var(--accent);
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 700;
        }

        .price-list-section {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 20px;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid var(--border);
        }
        .price-list-section h3 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 20px;
          padding-left: 10px;
          border-left: 4px solid var(--accent);
        }
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }
        .product-card {
          background: var(--bg-card);
          border: 2px solid var(--border);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .product-card:hover {
          border-color: var(--accent);
          background: var(--accent-light);
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 15px 35px rgba(123,47,247,0.2);
        }
        .product-icon {
          width: 64px;
          height: 64px;
          margin-bottom: 16px;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
          transition: transform 0.3s;
        }
        .product-card:hover .product-icon {
          transform: scale(1.1) rotate(5deg);
        }
        .product-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 12px;
          height: 48px;
          display: flex;
          align-items: center;
          color: var(--text-main);
          line-height: 1.3;
        }
        .product-price {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .price-primary {
          font-weight: 900;
          font-size: 22px;
          color: var(--accent);
          letter-spacing: -0.5px;
        }
        .price-secondary {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 600;
          opacity: 0.8;
        }

        .info-content-section {
          background: var(--bg-card);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          margin-bottom: 60px;
          border: 1px solid var(--border);
        }
        .info-tab-header {
          background: var(--bg-hover);
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
        }
        .info-tab-header h4 {
          margin: 0;
          font-weight: 700;
        }
        .info-body {
          padding: 24px;
          line-height: 1.8;
          color: var(--text-main);
        }
        .info-body h5 {
          font-size: 18px;
          font-weight: 700;
          margin-top: 30px;
          margin-bottom: 16px;
        }
        .info-body ul {
          padding-left: 20px;
        }

        .detail-sidebar {
          position: sticky;
          top: 100px;
          height: fit-content;
        }
        .purchase-card {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          border: 1px solid var(--border);
        }
        .purchase-card h3 {
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .purchase-card p {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .w-full { width: 100%; }
        .mb-12 { margin-bottom: 12px; }
        .sidebar-features {
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .feature-item {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .feature-item span {
          width: 36px;
          height: 36px;
          background: var(--bg-hover);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .feature-item strong {
          display: block;
          font-size: 14px;
          color: var(--text-main);
        }
        .feature-item small {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* BUY MODE TOGGLE & RECHARGE INFO */
        .buy-mode-toggle { 
          display: flex; 
          background: rgba(255,255,255,0.03); 
          border-radius: 12px; 
          padding: 4px; 
          border: 1px solid var(--border); 
          margin-bottom: 20px; 
          gap: 4px; 
        }
        .buy-mode-toggle button {
          flex: 1; 
          padding: 10px; 
          border-radius: 8px; 
          border: none; 
          background: transparent; 
          color: var(--text-muted); 
          font-size: 13px; 
          font-weight: 700; 
          cursor: pointer;
          transition: all 0.2s;
        }
        .buy-mode-toggle button.active {
          background: var(--accent); 
          color: white;
        }
        .card-recharge-info { 
          background: var(--bg-hover); 
          border: 1px solid var(--border); 
          border-radius: 16px; 
          padding: 20px; 
          margin-bottom: 20px; 
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-main);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: var(--accent);
        }

        .landing-footer {
          margin-top: 60px;
          background: #1a1d21;
          color: #a0aec0;
          padding: 80px 0 40px;
        }
        .footer-content {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 60px;
        }
        .footer-brand {
          max-width: 400px;
        }
        .footer-brand p {
          margin-top: 20px;
          line-height: 1.6;
        }
        .footer-links h4 {
          color: white;
          margin-bottom: 24px;
          font-size: 18px;
        }
        .footer-links a {
          display: block;
          color: #a0aec0;
          text-decoration: none;
          margin-bottom: 12px;
          transition: color 0.2s;
        }
        .footer-links a:hover {
          color: #00d2ff;
        }
        .footer-bottom {
          margin-top: 60px;
          padding-top: 30px;
          border-top: 1px solid rgba(255,255,255,0.05);
          text-align: center;
          font-size: 13px;
        }

        .landing-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-page);
        }

        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
          .detail-layout { grid-template-columns: 1fr; }
          .detail-sidebar { position: static; }
        }

        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .visible-mobile { display: flex !important; }
          .landing-header { height: 64px; }
          .landing-header-inner { gap: 10px; }
          .landing-header-left { gap: 10px; }
          .landing-header-right { gap: 12px; }
          .landing-logo-text { font-size: 16px; }
          .landing-logo-img { width: 32px; height: 32px; }
          .landing-logo-icon { width: 32px; height: 32px; font-size: 18px; }
          .user-avatar-small { width: 30px; height: 30px; font-size: 14px; }
          .hero-slider { 
            height: auto; 
            aspect-ratio: 3.5 / 1; 
            min-height: 90px;
            border-radius: 8px;
            margin: 0 auto;
            width: 100%;
          }
          .hero-slide {
            background-size: 100% 100%;
          }
          .hero-content { 
            left: 15px; 
            bottom: 15px; 
            max-width: 70%;
          }
          .hero-content h2 { font-size: 16px; margin-bottom: 4px; }
          .hero-content p { display: none; }
          .hero-content .btn-landing-primary { padding: 4px 10px; font-size: 11px; border-radius: 6px; }
          .slider-dots { bottom: 8px; }
          .dot { width: 5px; height: 5px; }
          .dot.active { width: 12px; }

          .footer-content { grid-template-columns: 1fr; gap: 40px; }
          .detail-layout { 
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .detail-header-area, .detail-sidebar-area, .detail-content-area {
            grid-area: auto;
          }
          .detail-header-card { 
            flex-direction: column; 
            text-align: center; 
            padding: 12px;
            gap: 12px;
            overflow: hidden;
            margin-bottom: 10px;
          }
          .detail-header-card.has-banner {
            padding: 0;
          }
          .detail-header-card.has-banner .detail-game-banner {
            border-radius: 0;
            aspect-ratio: 3.5 / 1;
          }
          .detail-header-card.has-banner .detail-header-info {
            padding: 12px 16px;
          }
          .detail-header-info h1 { font-size: 22px; margin-bottom: 4px; }
          .detail-stats { display: none !important; }

          .detail-game-banner { display: block; border-radius: 8px; }
          .detail-header-icon { width: 70px; height: 70px; }

          /* Sidebar compact on mobile */
          .purchase-card { 
            padding: 16px; 
          }
          .purchase-card h3 { font-size: 18px; margin-bottom: 12px !important; }
          .buy-mode-toggle { 
            margin-bottom: 12px !important; 
          }
          .buy-mode-toggle button {
            padding: 8px; font-size: 12px;
          }
          .card-recharge-info { 
            padding: 12px !important; 
          }
          .card-recharge-info .form-label { font-size: 11px !important; margin-bottom: 4px !important; }
          .card-recharge-info .form-input { padding: 10px 14px !important; font-size: 14px !important; }
          .sidebar-buttons button { padding: 12px !important; font-size: 14px !important; }
          .sidebar-features { display: none !important; }

          .games-grid { 
            grid-template-columns: 1fr 1fr; 
            gap: 10px;
            padding: 0;
          }
          .game-card {
            border-radius: 12px;
          }
          .game-info {
            padding: 6px 8px 4px;
          }
          .game-name {
            font-size: 13px;
          }
          .price-list-section { padding: 12px; margin-bottom: 15px; }
          .price-list-section h3 { margin-bottom: 10px; font-size: 17px; }
          .products-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .product-card { padding: 10px; border-radius: 16px; }
          .product-name { font-size: 12px; height: 32px; margin-bottom: 4px; }
          .product-icon { width: 40px; height: 40px; margin-bottom: 4px; }
          .price-primary { font-size: 16px; }
          .price-secondary { font-size: 10px; }
          
          .info-tab-header { padding: 10px 12px; }
          .info-body { padding: 12px; font-size: 13px; }
          
          .breadcrumb { margin-bottom: 10px; font-size: 13px; }
          .landing-container { padding: 0 10px; }
          .landing-hero { margin-bottom: 10px; }
          .landing-section { margin-top: 10px; }
          .section-header { margin-bottom: 10px; }
          .section-header h3 { font-size: 18px; }
        }
      `}} />
    </div>
  )
}

function GameCard({ juego, onSelect }) {
  // Generar un número de ventas estable basado en el ID para que no cambie al re-renderizar
  const sold = useMemo(() => {
    const seed = (juego.id || 0).toString().split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return (10 + (seed % 190)).toFixed(1) + 'K'
  }, [juego.id])

  return (
    <div className="game-card" onClick={onSelect}>
      {juego.etiqueta_descuento && <div className="badge-discount">{juego.etiqueta_descuento}</div>}
      <img 
        src={juego.icono_url || 'https://via.placeholder.com/200x250?text=' + juego.nombre} 
        alt={juego.nombre} 
        className="game-image" 
      />
      <div className="game-info">
        <div className="game-name">{juego.nombre}</div>
        <div className="game-meta hidden-mobile">
          <span className="rating">⭐ 5.0</span>
          <span>•</span>
          <span>{sold} Sold</span>
        </div>
      </div>
    </div>
  )
}
