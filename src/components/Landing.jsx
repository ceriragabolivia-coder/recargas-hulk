import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom'
import PaginaEstatica from './PaginaEstatica'
import { supabase } from '../lib/supabase'
import { useConfiguracion, useAuth, useCart, useCuentasGuardadas, useMetodosPago, useWallet } from '../hooks/useData'
import { formatUSD, formatBs, calcularPrecioVenta, playClientOrderSuccessSound, playClientWelcomeSound } from '../utils/helpers'
import LandingAuthModal from './LandingAuthModal'
import Checkout from './Checkout'
import Pedidos from './Pedidos'
import SupportChat from './SupportChat'
import LandingWallet from './LandingWallet'
import LandingPerfil from './LandingPerfil'
import Ruleta from './Ruleta'
import DOMPurify from 'dompurify'
import TutorialVideoModal from './TutorialVideoModal'
export default function Landing({ onNavigate }) {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const slug = params.slug || (location.pathname.startsWith('/p/') ? location.pathname.split('/p/')[1].replace(/\/$/, '') : null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { config, loading: configLoading } = useConfiguracion()
  const { user, perfil, logout } = useAuth()
  const { wallet } = useWallet()
  const { cart, addToCart, clearCart } = useCart()
  const { metodos } = useMetodosPago()
  const isRevendedor = user?.role === 'revendedor'
  
  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState('login')

  const [juegos, setJuegos] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_juegos');
      return cached ? JSON.parse(cached) : [];
    } catch (e) { return []; }
  })
  const [categorias, setCategorias] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_categorias');
      return cached ? JSON.parse(cached) : [];
    } catch (e) { return []; }
  })
  const [loading, setLoading] = useState(!localStorage.getItem('cached_juegos'))
  const [selectedJuego, setSelectedJuego] = useState(null)
  const [productosJuego, setProductosJuego] = useState([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [currentBanner, setCurrentBanner] = useState(0)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [showWallet, setShowWallet] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showRuleta, setShowRuleta] = useState(false)
  const [ordersParams, setOrdersParams] = useState(null)

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
  const [activeProductType, setActiveProductType] = useState('recarga')
  const [search, setSearch] = useState('')
  
  const [notificaciones, setNotificaciones] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const hasRecargas = productosJuego.some(p => p.tipo_producto === 'recarga' || !p.tipo_producto);
  const hasGiftCards = productosJuego.some(p => p.tipo_producto === 'gift_card');
  const hasPaquetes = productosJuego.some(p => p.tipo_producto === 'paquete');
  
  const showTabs = (hasRecargas ? 1 : 0) + (hasGiftCards ? 1 : 0) + (hasPaquetes ? 1 : 0) > 1;

  let currentViewType = activeProductType;
  if (currentViewType === 'recarga' && !hasRecargas) {
    currentViewType = hasPaquetes ? 'paquete' : 'gift_card';
  } else if (currentViewType === 'paquete' && !hasPaquetes) {
    currentViewType = hasRecargas ? 'recarga' : 'gift_card';
  } else if (currentViewType === 'gift_card' && !hasGiftCards) {
    currentViewType = hasRecargas ? 'recarga' : 'paquete';
  }

  const effectiveMetodoRecarga = currentViewType === 'gift_card' ? 'entrega_codigo' : (selectedJuego?.metodo_recarga || 'sin_datos');

  const [showNotiDropdown, setShowNotiDropdown] = useState(false)
  const [activeToast, setActiveToast] = useState(null)
  const [showTutorialModal, setShowTutorialModal] = useState(false)
  const [paginasFooter, setPaginasFooter] = useState([])
  
  // Modo Nocturno
  const [darkMode, setDarkMode] = useState(true)
  const [infoProductModal, setInfoProductModal] = useState(null)
  const [expandedImage, setExpandedImage] = useState(null)

  const banners = useMemo(() => {
    // Si está cargando y no hay caché, no devolvemos nada para evitar el banner genérico
    if (configLoading && (!config || Object.keys(config).length === 0)) return []; 
    
    if (config?.landing_banners_json) {
      try {
        const parsed = JSON.parse(config.landing_banners_json);
        if (parsed && parsed.length > 0) {
          const activeBanners = parsed.filter(b => b.active !== false);
          return activeBanners.length > 0 ? activeBanners : parsed; 
        }
      } catch (e) {
        console.error("Error parsing landing banners", e);
      }
    }

    // Solo si terminó de cargar Y no hay JSON, mostramos el fallback legacy si existe imagen
    if (!configLoading && config?.landing_banner_1) {
      return [
        {
          id: 1,
          image: config.landing_banner_1,
          title: config.landing_banner_1_title ?? config.landing_subtitulo ?? '¡Recargas al Instante!',
          text: config.landing_banner_1_text ?? 'Seguridad y confianza en cada transacción',
          btnText: config.landing_banner_1_btn_text ?? 'Empieza ahora',
          url: config.landing_banner_1_url ?? '/register',
          interval: config.landing_banner_1_interval || '5'
        }
      ];
    }

    return [];
  }, [config, configLoading]);

  useEffect(() => {
    localStorage.setItem('landing_dark_mode', darkMode)
  }, [darkMode])

  // Sincronizar estados con la URL para permitir recarga de página y navegación directa
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    if (path === '/billetera') {
      setShowWallet(true);
      setShowOrders(false);
      setShowProfile(false);
      setShowRuleta(false);
      setShowCheckout(false); // CERRAR CHECKOUT SI ESTÁ ABIERTO
      setSelectedJuego(null);
    } else if (path === '/mis-pedidos') {
      setShowOrders(true);
      setShowWallet(false);
      setShowProfile(false);
      setShowRuleta(false);
      setShowCheckout(false); // CERRAR CHECKOUT SI ESTÁ ABIERTO
      setSelectedJuego(null);
    } else if (path === '/mi-perfil') {
      setShowProfile(true);
      setShowOrders(false);
      setShowWallet(false);
      setShowRuleta(false);
      setShowCheckout(false); // CERRAR CHECKOUT SI ESTÁ ABIERTO
      setSelectedJuego(null);
    } else if (path === '/ruleta') {
      setShowRuleta(true);
      setShowProfile(false);
      setShowOrders(false);
      setShowWallet(false);
      setShowCheckout(false); // CERRAR CHECKOUT SI ESTÁ ABIERTO
      setSelectedJuego(null);
    }
  }, [location.pathname]);

  const resetRechargeForm = () => {
    setLocalRechargeData({
      player_id: '',
      zone_id: '',
      account_email: '',
      account_password: '',
      account_user: ''
    })
    setVerificacionResultado(null)
    setShouldSaveData(false)
  }

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
    resetRechargeForm()
  }

  useEffect(() => {
    async function fetchData() {
      const [jRes, cRes, pRes] = await Promise.all([
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
          .order('orden'),
        supabase.from('paginas_estaticas')
          .select('*')
          .eq('visible', true)
          .order('orden', { ascending: true })
      ])
      
      if (jRes.data) {
        setJuegos(jRes.data)
        localStorage.setItem('cached_juegos', JSON.stringify(jRes.data))
      }
      if (cRes.data) {
        setCategorias(cRes.data)
        localStorage.setItem('cached_categorias', JSON.stringify(cRes.data))
      }
      if (pRes.data) {
        setPaginasFooter(pRes.data)
      }
      setLoading(false)
      
      // OPTIMIZACIÓN: Precarga de imágenes críticas para que aparezcan instantáneamente
      jRes.data?.slice(0, 16).forEach(juego => {
        if (juego.icono_url) {
          const img = new Image();
          img.src = juego.icono_url;
        }
      });
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

    // 🔔 Suscripción Realtime para Notificaciones Generales
    const channelNotis = supabase
      .channel(`user_notis_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notificaciones_usuarios'
      }, (payload) => {
        // Filtramos manualmente por user_id para mayor robustez
        if (payload.new && payload.new.user_id === user.id) {
          setNotificaciones(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(count => count + 1);
          setActiveToast(payload.new);
          setTimeout(() => setActiveToast(null), 8000);
          playNotificationSound();
        }
      })
      .subscribe();

    // 📦 Suscripción Realtime para Cambios en Mis Pedidos
    const channelPedidos = supabase
      .channel(`user_orders_landing_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
        filter: `cliente_id=eq.${user.id}`
      }, payload => {
        const updated = payload.new;
        if (updated.estado === 'completado') {
          setActiveToast({
            titulo: `🎉 ¡Pedido #${updated.numero_pedido || 'N/A'} Completado!`,
            mensaje: 'Tu recarga ha sido procesada. 🎁 ¡Felicitaciones, ganaste un giro en la ruleta de premios! Haz clic aquí para jugar.',
            type: 'success',
            target: 'ruleta'
          });
          setTimeout(() => setActiveToast(null), 15000);
          playClientOrderSuccessSound();
        } else if (updated.estado === 'cancelado') {
          setActiveToast({
            titulo: `❌ Pedido #${updated.numero_pedido || 'N/A'} Cancelado`,
            mensaje: 'Tu pedido no pudo ser procesado. Revisa los detalles en tu perfil.',
            type: 'error',
            target: 'orders',
            orderId: updated.id
          });
          setTimeout(() => setActiveToast(null), 10000);
          playNotificationSound();
        }
      })
      .subscribe();

    // 🏦 Suscripción Realtime para Billetera
    const channelWallet = supabase
      .channel(`user_wallet_landing_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'billetera_recargas',
        filter: `auth_user_id=eq.${user.id}`
      }, payload => {
        const updated = payload.new;
        if (updated.estado === 'aprobado') {
          setActiveToast({
            titulo: '✅ ¡Saldo Acreditado!',
            mensaje: `Tu recarga por ${formatBs(updated.moneda === 'bs' ? updated.monto : Math.round(updated.monto * (Number(config?.tasa_dolar) || 1)))} ha sido aprobada.`,
            type: 'success'
          });
          setTimeout(() => setActiveToast(null), 10000);
          playNotificationSound();
        }
      })
      .subscribe();

    const playNotificationSound = () => {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.volume = 0.4;
        audio.play();
      } catch (e) {}
    };

    return () => {
      supabase.removeChannel(channelNotis);
      supabase.removeChannel(channelPedidos);
      supabase.removeChannel(channelWallet);
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      const hasPlayed = sessionStorage.getItem('client_welcome_played')
      if (!hasPlayed) {
        playClientWelcomeSound()
        sessionStorage.setItem('client_welcome_played', 'true')
      }
    }
  }, [user?.id])

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
      if (found && selectedJuego !== found) {
        setSelectedJuego(found)
      }
    } else if (!juegoIdQuery && selectedJuego) {
      setSelectedJuego(null)
    }
  }, [searchParams, juegos, selectedJuego])

  // EFECTO DE SCROLL AL TOP: Forzar siempre al cambiar de vista o seleccionar juego
  useEffect(() => {
    let isMounted = true;
    const forceScroll = () => {
      if (!isMounted) return;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        rootEl.scrollTop = 0;
      }
    };
    
    forceScroll();
    // Re-intentar varias veces para asegurar que el navegador no restaure el scroll anterior
    const t1 = setTimeout(forceScroll, 10);
    const t2 = setTimeout(forceScroll, 100);
    const t3 = setTimeout(forceScroll, 300);
    const t4 = setTimeout(forceScroll, 600);
    return () => {
      isMounted = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [searchParams.get('juego'), selectedJuego?.id, showCheckout, showOrders, showRuleta, showWallet, showProfile]);

  const handleSelectJuego = (juego) => {
    setActiveProductType('recarga')
    setShowCheckout(false)
    setShowOrders(false)
    setShowWallet(false)
    setShowProfile(false)
    setShowRuleta(false)
    window.scrollTo(0, 0)
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.scrollTop = 0;
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
    return juegos // Mostrar todos los juegos en lugar de limitar a 20
  }, [juegos, config])

  // Ya no bloqueamos toda la página con un spinner. 
  // Las secciones internas (como productos o juegos) ya tienen sus propios esqueletos/spinners locales si es necesario.
  // Pero permitimos que el Header y el Hero (con fallbacks) se vean de inmediato.

  return (
    <div 
      className={`landing-page ${darkMode ? 'dark' : ''}`}
      style={{
        backgroundImage: config?.fondo_global_url ? `url(${config.fondo_global_url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* TOAST NOTIFICATION */}
      {activeToast && (
        <div 
          className="noti-toast fade-in" 
          onClick={() => { 
            if (activeToast.target === 'orders') {
              setOrdersParams({ orderId: activeToast.orderId });
              setShowOrders(true);
              setShowCheckout(false);
              setShowWallet(false);
              setShowProfile(false);
              setShowRuleta(false);
              setSelectedJuego(null);
              window.scrollTo(0, 0);
            } else if (activeToast.target === 'ruleta') {
              navigate('/Ruleta');
              setShowRuleta(true);
              setShowCheckout(false);
              setShowOrders(false);
              setShowWallet(false);
              setShowProfile(false);
              setSelectedJuego(null);
              window.scrollTo(0, 0);
            } else {
              setShowNotiDropdown(true);
            }
            setActiveToast(null); 
          }}
          style={{
            position: 'fixed', top: '90px', right: '20px', zIndex: 10000,
            background: 'var(--bg-card)', border: '1px solid var(--accent)',
            borderRadius: '16px', padding: '16px 20px', width: '320px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)', cursor: 'pointer',
            display: 'flex', gap: '12px', alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '24px' }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--accent)', marginBottom: '2px' }}>{activeToast.titulo}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4' }}>{activeToast.mensaje}</div>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
        </div>
      )}

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
              {/* Servicios removido según solicitud del usuario */}
              <a href="#" className={`nav-link ${showRuleta ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/Ruleta'); }}>Ruleta</a>
              <a href="#" className="nav-link">Ayuda</a>
            </nav>
          </div>

          <div className="flex items-center landing-header-right">
            <div className="landing-search hidden-mobile" style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Buscar juegos o servicios..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => setTimeout(() => setSearch(''), 200)}
              />
              <span className="search-icon">🔍</span>
              
              {search.trim().length > 0 && (
                <div className="search-results-dropdown">
                  {juegos
                    .filter(j => j.nombre.toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 8)
                    .map(juego => (
                      <div 
                        key={juego.id} 
                        className="search-result-item"
                        onClick={() => {
                          handleSelectJuego(juego);
                          setSearch('');
                        }}
                      >
                        <img src={juego.icono_url ? (juego.icono_url.includes('?') ? `${juego.icono_url}&v=3` : `${juego.icono_url}?v=3`) : 'https://via.placeholder.com/40'} alt={juego.nombre} />
                        <div className="result-info">
                          <div className="result-name">{juego.nombre}</div>
                          <div className="result-cat">{juego.categoria}</div>
                        </div>
                      </div>
                    ))
                  }
                  {juegos.filter(j => j.nombre.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <div className="search-no-results">No se encontraron resultados</div>
                  )}
                </div>
              )}
            </div>
            
            {/* BILLETERA (Siempre visible) */}
            {user && (
              <div
                className="header-wallet"
                onClick={() => {
                  setShowWallet(true);
                  setShowCheckout(false);
                  setShowRuleta(false);
                  setSelectedJuego(null);
                  window.scrollTo(0, 0);
                }}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'rgba(255,255,255,0.1)', 
                  padding: '6px 12px', 
                  borderRadius: '20px',
                  marginRight: '8px',
                  flexShrink: 0
                }}
                title="Billetera"
              >
                <span style={{ fontSize: '18px' }}>💰</span>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--accent-success)', whiteSpace: 'nowrap' }}>
                  {formatUSD(wallet?.saldo || 0)}
                </span>
              </div>
            )}

            {/* CARRITO (Solo Desktop) */}
            {user && (
              <div 
                className="hidden-mobile"
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '8px' }} 
                onClick={() => {
                  setShowCheckout(true);
                  setShowRuleta(false);
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

            {/* CAMPANA DE NOTIFICACIONES (Solo Desktop) */}
            {user && (
              <div className="nav-dropdown hidden-mobile" style={{ position: 'relative', marginRight: '8px' }}>
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
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowOrders(true); setShowRuleta(false); setShowNotiDropdown(false); setSelectedJuego(null); }} style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', textDecoration: 'none' }}>Ver todos mis pedidos</a>
                  </div>
                </div>
              </div>
            )}

            {user ? (
              <div className="nav-dropdown">
                <div className="flex items-center" style={{ gap: '8px', cursor: 'pointer' }}>
                  <div className="user-avatar-small" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {perfil?.avatar_url ? (
                      <img src={perfil.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      user.email?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="hidden-mobile" style={{ fontWeight: '600' }}>Mi Cuenta ▾</span>
                </div>
                <div className="dropdown-content" style={{ right: 0, left: 'auto' }}>
                  <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Conectado como</div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{user.email}</div>
                  </div>
                  
                  {/* Carrito y Notificaciones en Móvil */}
                  <a href="#" className="visible-mobile" onClick={(e) => { 
                    e.preventDefault(); 
                    setShowCheckout(true);
                    setShowRuleta(false);
                    setSelectedJuego(null);
                    window.scrollTo(0, 0); 
                  }}>
                    🛒 Carrito {cart.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', marginLeft: '4px' }}>{cart.length}</span>}
                  </a>
                  <a href="#" className="visible-mobile" onClick={(e) => { 
                    e.preventDefault(); 
                    setShowNotiDropdown(!showNotiDropdown);
                  }}>
                    🔔 Notificaciones {unreadCount > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', marginLeft: '4px' }}>{unreadCount}</span>}
                  </a>

                  {(user?.role === 'admin' || user?.role === 'negocio' || perfil?.rol === 'admin' || perfil?.rol === 'negocio' || perfil?.rol === 'administrador') && (
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Dashboard') }} style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Panel de Control</a>
                  )}
                  <a href="#" className="visible-mobile" onClick={(e) => { e.preventDefault(); handleSelectJuego(null); setTimeout(() => { const element = document.getElementById('all-games'); if (element) element.scrollIntoView({ behavior: 'smooth' }); }, 100); }}>Servicios</a>
                  <a href="#" className="visible-mobile" onClick={(e) => { e.preventDefault(); navigate('/Ruleta'); }}>Ruleta</a>
                  <a href="#" className="visible-mobile" onClick={(e) => { e.preventDefault(); }}>Ayuda</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Mi-Perfil'); }}>Mi Perfil</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Mis-Pedidos'); }}>Mis Pedidos</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Billetera'); }}>Billetera</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); logout() }} style={{ color: '#ef4444' }}>Cerrar Sesión</a>
                </div>
              </div>
            ) : (
              <div className="flex items-center" style={{ gap: '10px' }}>
                <button className="btn-landing-secondary hidden-mobile" onClick={() => { setAuthModalView('login'); setIsAuthModalOpen(true); }}>Entrar</button>
                <button className="btn-landing-primary hidden-mobile" onClick={() => { setAuthModalView('register'); setIsAuthModalOpen(true); }}>Registrarse</button>
                <div className="nav-dropdown visible-mobile">
                  <button className="btn-mobile-auth-icon" title="Menú">
                    👤
                  </button>
                  <div className="dropdown-content" style={{ right: 0, left: 'auto' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setAuthModalView('login'); setIsAuthModalOpen(true); }} style={{ fontWeight: 'bold' }}>Entrar</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); setAuthModalView('register'); setIsAuthModalOpen(true); }} style={{ fontWeight: 'bold' }}>Registrarse</a>
                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}></div>
                    <a href="#" onClick={(e) => { e.preventDefault(); handleSelectJuego(null); setTimeout(() => { const element = document.getElementById('all-games'); if (element) element.scrollIntoView({ behavior: 'smooth' }); }, 100); }}>Servicios</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/Ruleta'); }}>Ruleta</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); }}>Ayuda</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="landing-main">
        {/* HERO SLIDER (Solo en Home arriba) */}
        {!slug && !selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && !search.trim() && (
          <section className="landing-hero landing-container">
            {!config ? (
              <div className="hero-slider skeleton-loader" style={{ height: '400px', background: 'var(--bg-hover)', borderRadius: '24px', opacity: 0.3, animation: 'pulse 1.5s infinite' }}></div>
            ) : banners.length > 0 ? (
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
            ) : null}
          </section>
        )}

        {slug ? (
          <div className="fade-in landing-container" style={{ width: '100%', minHeight: '60vh', padding: '40px 20px' }}>
            <PaginaEstatica slug={slug} />
          </div>
        ) : showCheckout ? (
          <Checkout embedded={true} onFinish={() => setShowCheckout(false)} />
        ) : showOrders ? (
          <div className="fade-in" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
             <Pedidos embedded={true} params={ordersParams} />
          </div>
        ) : showRuleta ? (
          <div className="fade-in" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
             <Ruleta embedded={true} />
          </div>
        ) : showWallet ? (
          <div className="fade-in wallet-page-wrapper">
             <LandingWallet onClose={() => setShowWallet(false)} />
          </div>
        ) : showProfile ? (
          <div className="fade-in" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
             <LandingPerfil onClose={() => setShowProfile(false)} />
          </div>
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
                      <img 
                        src={selectedJuego.banner_url} 
                        alt={selectedJuego.nombre} 
                        fetchpriority="high"
                        loading="eager"
                      />
                    </div>
                  ) : (
                    <img src={selectedJuego.icono_url ? (selectedJuego.icono_url.includes('?') ? `${selectedJuego.icono_url}&v=3` : `${selectedJuego.icono_url}?v=3`) : ''} alt="" className="detail-header-icon" />
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
                        {effectiveMetodoRecarga === 'sin_datos' ? (
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600, margin: 0 }}>⚡ Entrega inmediata</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>No necesitas ingresar ningún dato.</p>
                          </div>
                        ) : effectiveMetodoRecarga === 'entrega_codigo' ? (
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600, margin: 0 }}>🎁 Entrega de Código</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Recibirás un código de Gift Card tras la compra.</p>
                          </div>
                        ) : effectiveMetodoRecarga === 'solo_correo' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>📧 Correo Electrónico</label>
                                {selectedJuego?.guia_id_url && (
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent-primary)', color:'#fff', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
                                )}
                              </div>
                              <input 
                                type="email" 
                                className="form-input" 
                                placeholder="ejemplo@correo.com"
                                value={localRechargeData.account_email}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_email: e.target.value})}
                              />
                            </div>
                          </div>
                        ) : effectiveMetodoRecarga === 'solo_usuario' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>👤 Usuario (@)</label>
                                {selectedJuego?.guia_id_url && (
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent-primary)', color:'#fff', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
                                )}
                              </div>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="@Usuario"
                                value={localRechargeData.account_user || ''}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_user: e.target.value})}
                              />
                            </div>
                          </div>
                        ) : effectiveMetodoRecarga === 'cuenta_completa' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>📧 Correo</label>
                                {selectedJuego?.guia_id_url && (
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent-primary)', color:'#fff', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
                                )}
                              </div>
                              <input 
                                type="email" 
                                className="form-input" 
                                placeholder="ejemplo@correo.com"
                                value={localRechargeData.account_email}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_email: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>🔑 Contraseña</label>
                              <input 
                                type="password" 
                                className="form-input" 
                                placeholder="********"
                                value={localRechargeData.account_password}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                              />
                            </div>
                          </div>
                        ) : effectiveMetodoRecarga === 'usuario_clave' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>👤 Usuario</label>
                                {selectedJuego?.guia_id_url && (
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent-primary)', color:'#fff', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
                                )}
                              </div>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Tu usuario"
                                value={localRechargeData.account_user || ''}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_user: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>🔑 Contraseña</label>
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>🆔 ID del Jugador</label>
                                {selectedJuego?.guia_id_url && (
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent-primary)', color:'#fff', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'bold' }} title="Ver guía">?</div>
                                )}
                              </div>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Introduce el ID"
                                value={localRechargeData.player_id}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 30);
                                  setLocalRechargeData({...localRechargeData, player_id: val});
                                  if (verificacionResultado) setVerificacionResultado(null);
                                }}
                                style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}
                              />
                            </div>
                            
                            {effectiveMetodoRecarga === 'id_zone' && (
                              <div>
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>🆔 Zone ID</label>
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

                            {(selectedJuego.verificacion_api_activa || (selectedJuego.verificacion_api_activa === undefined && (selectedJuego.nombre.toLowerCase().includes('free fire') || selectedJuego.nombre.toLowerCase().includes('bloodstrike')))) && (
                              <div>
                                <button 
                                  className="btn-verify-prominent"
                                  onClick={handleVerificarJugador}
                                  disabled={isVerificando}
                                  style={{ 
                                    width: '100%', 
                                    fontSize: '14px', 
                                    padding: '12px',
                                    marginTop: '8px'
                                  }}
                                >
                                  {isVerificando ? 'Verificando...' : '🔍 Verificar Jugador'}
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
                          <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
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

                        {!(effectiveMetodoRecarga === 'sin_datos' || effectiveMetodoRecarga === 'entrega_codigo') && (
                          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="checkbox" 
                              id="save-data-checkbox-landing"
                              checked={shouldSaveData}
                              onChange={(e) => setShouldSaveData(e.target.checked)}
                            />
                            <label htmlFor="save-data-checkbox-landing" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Guardar datos</label>
                          </div>
                        )}
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

                  {selectedJuego.tutorial_video_url && (
                    <div 
                      className="tutorial-banner-card"
                      onClick={() => setShowTutorialModal(true)}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        marginTop: '16px',
                        border: '1px solid rgba(0, 210, 255, 0.3)',
                        background: 'var(--bg-card)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,210,255,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)' }}
                    >
                      {selectedJuego.tutorial_banner_img ? (
                        <img src={selectedJuego.tutorial_banner_img} alt="Tutorial" style={{ width: '100%', display: 'block' }} />
                      ) : (
                        <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(0, 115, 230, 0.1) 100%)' }}>
                          <div style={{ 
                            width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(0, 210, 255, 0.2)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0,
                            boxShadow: '0 0 15px rgba(0, 210, 255, 0.3)'
                          }}>
                            🔔
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                              {selectedJuego.tutorial_banner_texto || `¿Cómo recargar?`}
                            </h4>
                            <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                              Ver video tutorial
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </aside>

              {/* LISTA DE PRECIOS E INFORMACIÓN */}
              <div className="detail-content-area">
                <div className="price-list-section">
                  <h3>Selecciona un paquete</h3>
                  {loadingProductos ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      {(() => {
                        const filteredProducts = productosJuego.filter(p => {
                          if (currentViewType === 'gift_card') return p.tipo_producto === 'gift_card';
                          if (currentViewType === 'paquete') return p.tipo_producto === 'paquete';
                          return p.tipo_producto === 'recarga' || !p.tipo_producto;
                        });

                        return (
                          <>
                            {showTabs && (
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {hasRecargas && (
                                  <button 
                                    onClick={() => setActiveProductType('recarga')}
                                    style={{
                                      flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                                      backgroundColor: currentViewType === 'recarga' ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
                                      color: currentViewType === 'recarga' ? 'var(--accent-primary)' : 'var(--text-muted)',
                                      border: currentViewType === 'recarga' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', minWidth: '120px'
                                    }}
                                  >
                                    {selectedJuego?.metodo_recarga === 'cuenta_completa' || selectedJuego?.metodo_recarga === 'usuario_clave' ? 'Recarga Interna' : selectedJuego?.metodo_recarga === 'solo_usuario' ? 'Recarga por Usuario' : selectedJuego?.metodo_recarga === 'solo_correo' ? 'Recarga por Correo' : 'Recarga por ID'}
                                  </button>
                                )}
                                {hasPaquetes && (
                                  <button 
                                    onClick={() => setActiveProductType('paquete')}
                                    style={{
                                      flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                                      backgroundColor: currentViewType === 'paquete' ? 'rgba(156, 39, 176, 0.15)' : 'transparent',
                                      color: currentViewType === 'paquete' ? '#e040fb' : 'var(--text-muted)',
                                      border: currentViewType === 'paquete' ? '1px solid #e040fb' : '1px solid var(--border-color)',
                                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', minWidth: '120px'
                                    }}
                                  >
                                    Paquetes
                                  </button>
                                )}
                                {hasGiftCards && (
                                  <button 
                                    onClick={() => setActiveProductType('gift_card')}
                                    style={{
                                      flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                                      backgroundColor: currentViewType === 'gift_card' ? 'rgba(255, 171, 0, 0.15)' : 'transparent',
                                      color: currentViewType === 'gift_card' ? 'var(--accent-warning)' : 'var(--text-muted)',
                                      border: currentViewType === 'gift_card' ? '1px solid var(--accent-warning)' : '1px solid var(--border-color)',
                                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', minWidth: '120px'
                                    }}
                                  >
                                    Gift Cards
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="products-grid">
                              {filteredProducts.map(prod => {
                        const pricing = calcularPrecioVenta(prod, selectedJuego, config)
                        return (
                          <div key={prod.id} className="product-card" onClick={() => {
                            if (!user) {
                              setAuthModalView('login');
                              setIsAuthModalOpen(true);
                              return;
                            }
                            
                            const prodEffectiveMetodo = (prod.tipo_producto === 'gift_card') ? 'entrega_codigo' : effectiveMetodoRecarga;

                            if (prodEffectiveMetodo === 'sin_datos') {
                              // OK
                            } else if (prodEffectiveMetodo === 'solo_correo') {
                              if (!localRechargeData.account_email.trim()) {
                                alert('Por favor introduce el correo arriba primero.')
                                return
                              }
                            } else if (prodEffectiveMetodo === 'cuenta_completa') {
                              if (!localRechargeData.account_email.trim() || !localRechargeData.account_password.trim()) {
                                alert('Por favor introduce el correo y clave arriba primero.')
                                return
                              }
                            } else if (prodEffectiveMetodo === 'usuario_clave') {
                              if (!localRechargeData.account_user?.trim() || !localRechargeData.account_password.trim()) {
                                alert('Por favor introduce el usuario y clave arriba primero.')
                                return
                              }
                            } else if (prodEffectiveMetodo === 'sin_datos' || prodEffectiveMetodo === 'entrega_codigo') {
                              // No se requieren datos
                            } else {
                              if (!localRechargeData.player_id.trim()) {
                                alert('Por favor introduce el ID arriba primero.')
                                return
                              }
                              const isVerificationActive = selectedJuego.verificacion_api_activa || 
                                  (selectedJuego.verificacion_api_activa === undefined && (selectedJuego.nombre.toLowerCase().includes('free fire') || selectedJuego.nombre.toLowerCase().includes('bloodstrike')));

                                if (isVerificationActive) {
                                if (!verificacionResultado?.success || verificacionResultado.verified_id !== localRechargeData.player_id) {
                                  alert('Debes verificar el nombre del jugador arriba antes de seleccionar un paquete.')
                                  return
                                }
                              }
                            }
                            
                            const finalPrice = calcularPrecioVenta(prod, selectedJuego, config, perfil)
                            setPendingItem({ 
                              p: prod, 
                              selectedJuego, 
                              finalPrice, 
                              localRechargeData: {
                                ...localRechargeData,
                                nickname: (verificacionResultado?.success && verificacionResultado.verified_id === localRechargeData.player_id) 
                                          ? verificacionResultado.nickname : null
                              } 
                            })
                          }}>
                            {prod.icono_url && <img src={prod.icono_url.includes('?') ? `${prod.icono_url}&v=3` : `${prod.icono_url}?v=3`} alt="" className="product-icon" />}
                            <div className="product-name">{prod.nombre}</div>
                            <div className="product-price" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span className="price-primary">{formatBs(pricing.venta_bs)}</span>
                              {selectedJuego.mostrar_precio_dual && (
                                <span style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px', fontWeight: 600 }}>{formatUSD(pricing.venta_usd)}</span>
                              )}
                            </div>
                            
                            {(prod.info_adicional_texto || prod.info_adicional_imagen_url) && (
                              <div 
                                onClick={(e) => { e.stopPropagation(); setInfoProductModal(prod); }} 
                                style={{ 
                                  position: 'absolute', top: '4px', right: '4px',
                                  backgroundColor: '#ff2a2a', color: '#ffffff', 
                                  fontSize: '11px', fontWeight: '900', cursor: 'pointer', 
                                  borderRadius: '50%', width: '18px', height: '18px', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: '0 4px 12px rgba(255, 42, 42, 0.6)', border: '1px solid #ffffff',
                                  transition: 'all 0.2s', zIndex: 2
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                title="Información importante"
                              >
                                i
                              </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
                </>
              )}
            </div>

            {/* Información / Guías */}
            <div className="info-content-section">
                  <div className="info-tab-header">
                    <h4>Información de {selectedJuego.nombre}</h4>
                  </div>
                  <div className="info-body">
                    {selectedJuego.caracteristicas_nota && (
                      <div className="rich-text" style={{ marginBottom: '16px' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedJuego.caracteristicas_nota.replace(/\n/g, '<br/>')) }} />
                    )}
                    
                    {selectedJuego.instrucciones_recarga && (
                      <div className="rich-text" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedJuego.instrucciones_recarga.replace(/\n/g, '<br/>')) }} />
                    )}

                    {!selectedJuego.caracteristicas_nota && !selectedJuego.instrucciones_recarga && (
                      <p style={{ color: 'var(--text-muted)' }}>No hay información adicional disponible para este producto.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* HERO SLIDER (En Detalle abajo) */}
            <section className="landing-hero" style={{ marginTop: '40px', padding: 0 }}>
              <div className="hero-slider">
                {banners.map((banner, idx) => (
                  <div 
                    key={idx} 
                    className={`hero-slide ${idx === currentBanner ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${banner.image})` }}
                  >
                    <div className="hero-content" style={{ bottom: '30px', left: '30px' }}>
                      {banner.title && <h2 style={{ fontSize: '24px' }}>{banner.title}</h2>}
                      {banner.text && <p style={{ fontSize: '14px' }}>{banner.text}</p>}
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
          </div>
        ) : (
          /* VISTA CATALOGO PRINCIPAL */
          <>


            {!search.trim() && activeCategory === 'Todos' && (
              <section className="landing-section landing-container">
                <div className="section-header">
                  <h3>Recarga Aquí</h3>
                  <a href="#all-games" className="view-all">Ver todos &gt;</a>
                </div>
                <div className="games-grid">
                  {loading ? (
                    Array(8).fill(0).map((_, i) => (
                      <div key={i} className="game-card-skeleton" style={{ height: '220px', backgroundColor: 'var(--bg-hover)', borderRadius: '16px', opacity: 0.5, animation: 'pulse 1.5s infinite' }}></div>
                    ))
                  ) : bestsellers.length > 0 ? (
                    bestsellers.map(juego => (
                      <GameCard key={juego.id} juego={juego} onSelect={() => handleSelectJuego(juego)} />
                    ))
                  ) : (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No se encontraron servicios destacados.</div>
                  )}
                </div>
              </section>
            )}

            {/* ALL GAMES / CATEGORIES */}
            <section id="all-games" className="landing-section landing-container" style={{ marginTop: search.trim() ? '20px' : undefined }}>
              <div className="section-header">
                <h3>{activeCategory === 'Todos' ? 'Explorar Catálogo' : `Servicios: ${activeCategory}`}</h3>
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
                {loading && juegos.length === 0 ? (
                  Array(12).fill(0).map((_, i) => (
                    <div key={i} className="game-card-skeleton" style={{ 
                      height: '240px', 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      borderRadius: '16px', 
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ height: '75%', background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s infinite' }}></div>
                      <div style={{ padding: '15px' }}>
                        <div style={{ height: '12px', width: '70%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }}></div>
                        <div style={{ height: '10px', width: '40%', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                      </div>
                    </div>
                  ))
                ) : filteredJuegos.length > 0 ? (
                  filteredJuegos.map(juego => (
                    <GameCard key={juego.id} juego={juego} onSelect={() => handleSelectJuego(juego)} />
                  ))
                ) : (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No se encontraron servicios en esta categoría.</div>
                )}
              </div>
            </section>
          </>
        )}

        {!selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && config?.landing_seo_texto && (
          <section className="landing-section landing-container" style={{ marginTop: '40px', paddingBottom: '20px' }}>
            <div className="info-content-section" style={{ background: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div className="info-tab-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                <h4 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>ℹ️</span> Información Adicional
                </h4>
              </div>
              <div className="info-body" style={{ padding: '24px' }}>
                <div className="rich-text" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(config.landing_seo_texto.replace(/\n/g, '<br/>')) }} />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="landing-footer">
        {/* Top accent line */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--accent), #00d2ff, var(--accent))' }} />

        <div className="landing-container" style={{ padding: '56px 20px 40px' }}>
          <div className="footer-grid-new">

            {/* Col 1: Brand */}
            <div className="footer-col-brand">
              <div className="landing-logo-container" onClick={() => handleSelectJuego(null)} style={{ marginBottom: '16px' }}>
                {config?.landing_logo ? (
                  <img src={config.landing_logo} alt="Logo" style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'contain' }} />
                ) : (
                  <div className="landing-logo-icon">⚡</div>
                )}
                <span className="landing-logo-text">{config?.landing_titulo || 'Ceriraga'}</span>
              </div>
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#8a9bb5', maxWidth: '240px', margin: '0 0 20px 0' }}>
                {config?.footer_descripcion || 'Recargas, gift cards y servicios digitales al instante.'}
              </p>

              {/* Ayuda links */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Ayuda</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                  {paginasFooter.filter(p => p.categoria === 'Soporte').length > 0
                    ? paginasFooter.filter(p => p.categoria === 'Soporte').map(p => (
                        <a key={p.id} href="#" onClick={(e) => { e.preventDefault(); onNavigate('p/' + p.slug); }} className="footer-link-small">{p.titulo}</a>
                      ))
                    : <>
                        <a href="#" className="footer-link-small">FAQ</a>
                        <a href="#" className="footer-link-small">Privacidad</a>
                        <a href="#" className="footer-link-small">Términos</a>
                        <a href="#" className="footer-link-small">Reembolso</a>
                      </>
                  }
                </div>
              </div>
            </div>

            {/* Col 2: Productos (juegos del catálogo) */}
            <div className="footer-col-products">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Productos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(() => {
                    let ids = []
                    try { ids = JSON.parse(config?.footer_productos_ids || '[]') } catch(e) {}
                    const footerJuegos = ids.length > 0
                      ? ids.map(id => juegos.find(j => j.id === id)).filter(Boolean)
                      : juegos.slice(0, 8)
                    return footerJuegos
                  })().map(j => (
                  <button
                    key={j.id}
                    onClick={() => handleSelectJuego(j)}
                    className="footer-product-btn"
                  >
                    {j.icono_url ? (
                      <img src={j.icono_url ? (j.icono_url.includes('?') ? `${j.icono_url}&v=3` : `${j.icono_url}?v=3`) : ''} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent), #00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🎮</div>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#c8d6e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nombre}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Col 3: Social + Métodos de Pago */}
            <div className="footer-col-social">
              {/* Redes Sociales */}
              {(config?.footer_instagram || config?.footer_tiktok || config?.footer_youtube || config?.footer_whatsapp || config?.footer_twitter || config?.footer_facebook) && (
                <div className="footer-social-box">
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '14px', textAlign: 'center' }}>¡Síguenos en nuestras redes!</div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {config?.footer_youtube && (
                      <a href={config.footer_youtube} target="_blank" rel="noopener noreferrer" className="footer-social-icon" style={{ '--sc': '#FF0000' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      </a>
                    )}
                    {config?.footer_instagram && (
                      <a href={config.footer_instagram} target="_blank" rel="noopener noreferrer" className="footer-social-icon" style={{ '--sc': '#E1306C' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      </a>
                    )}
                    {config?.footer_tiktok && (
                      <a href={config.footer_tiktok} target="_blank" rel="noopener noreferrer" className="footer-social-icon" style={{ '--sc': '#fff' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/></svg>
                      </a>
                    )}
                    {config?.footer_whatsapp && (
                      <a href={`https://wa.me/${config.footer_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="footer-social-icon" style={{ '--sc': '#25D366' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </a>
                    )}
                    {config?.footer_facebook && (
                      <a href={config.footer_facebook} target="_blank" rel="noopener noreferrer" className="footer-social-icon" style={{ '--sc': '#1877F2' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    )}
                    {config?.footer_twitter && (
                      <a href={config.footer_twitter} target="_blank" rel="noopener noreferrer" className="footer-social-icon" style={{ '--sc': '#000' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Métodos de Pago */}
              {metodos && metodos.filter(m => m.activo).length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#8a9bb5', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Métodos de Pago</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {metodos.filter(m => m.activo).map(m => (
                      <div key={m.id} className="footer-payment-badge">
                        {m.icono_url
                          ? <img src={m.icono_url} alt={m.nombre} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                          : <span style={{ fontSize: '12px' }}>💳</span>
                        }
                        <span>{m.nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#5a6a7e', margin: 0 }}>
            © {new Date().getFullYear()} {config?.landing_titulo || 'Ceriraga'}. Todos los derechos reservados.
            {paginasFooter.filter(p => p.categoria === 'Empresa').map(p => (
              <span key={p.id}>
                {' · '}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('p/' + p.slug); }} style={{ color: '#5a6a7e', textDecoration: 'none' }} onMouseEnter={e => e.target.style.color='#00d2ff'} onMouseLeave={e => e.target.style.color='#5a6a7e'}>{p.titulo}</a>
              </span>
            ))}
          </p>
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
                
                {(() => {
                  const pendingEffectiveMetodo = (pendingItem.p.tipo_producto === 'gift_card') ? 'entrega_codigo' : (pendingItem.selectedJuego.metodo_recarga || 'sin_datos');
                  return (
                    <>
                      {pendingEffectiveMetodo === 'sin_datos' ? (
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>⚡ Entrega Inmediata (Sin Datos)</div>
                      ) : pendingEffectiveMetodo === 'entrega_codigo' ? (
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>🎁 Entrega de Código (Gift Card)</div>
                      ) : pendingEffectiveMetodo === 'solo_correo' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Correo:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.account_email}</strong></div>
                      </>
                      ) : pendingEffectiveMetodo === 'solo_usuario' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Usuario:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.account_user}</strong></div>
                      </>
                      ) : pendingEffectiveMetodo === 'cuenta_completa' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Correo:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.account_email}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Clave:</span> <strong style={{ color: '#fff' }}>••••••••</strong></div>
                      </>
                      ) : pendingEffectiveMetodo === 'usuario_clave' ? (
                        <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Usuario:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.account_user}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Clave:</span> <strong style={{ color: '#fff' }}>••••••••</strong></div>
                      </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Player ID:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.player_id}</strong></div>
                          {pendingEffectiveMetodo === 'id_zone' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Zone ID:</span> <strong style={{ color: '#fff' }}>{pendingItem.localRechargeData.zone_id}</strong></div>
                    )}
                    {verificacionResultado?.success && verificacionResultado.verified_id === pendingItem.localRechargeData.player_id && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Nombre:</span> <strong style={{ color: '#00c853' }}>{verificacionResultado.nickname}</strong>
                      </div>
                          )}
                        </>
                      )}
                    </>
                  )
                })()}
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

      {/* CHAT DE SOPORTE (Siempre activo para recibir notificaciones realtime) */}
      {perfil && (
        <SupportChat 
          perfil={perfil} 
          onNavigate={onNavigate} 
        />
      )}

      <LandingAuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialView={authModalView} 
      />

      {selectedJuego && (
        <TutorialVideoModal 
          isOpen={showTutorialModal} 
          onClose={() => setShowTutorialModal(false)} 
          videoUrl={selectedJuego.tutorial_video_url} 
          title={`¿Cómo recargar ${selectedJuego.nombre}?`} 
        />
      )}

      {/* MODAL DE INFO ADICIONAL (ⓘ) */}
      {infoProductModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10005,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s', padding: '16px', backdropFilter: 'blur(5px)'
        }} onClick={() => setInfoProductModal(null)}>
          <div style={{
            backgroundColor: 'var(--bg-panel)', width: '100%', maxWidth: '420px',
            borderRadius: '24px', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.8)', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)', animation: 'scaleUp 0.3s'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>{infoProductModal.nombre}</span>
              </div>
              <button 
                onClick={() => setInfoProductModal(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            
            <div style={{ padding: '0', maxHeight: '70vh', overflowY: 'auto' }}>
              {infoProductModal.info_adicional_imagen_url && (
                <div 
                  onClick={() => setExpandedImage(infoProductModal.info_adicional_imagen_url)}
                  style={{ 
                    width: '100%', 
                    height: '40vh',
                    minHeight: '250px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    backgroundColor: '#000',
                    backgroundImage: `url(${infoProductModal.info_adicional_imagen_url})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    cursor: 'zoom-in',
                    position: 'relative'
                  }}
                  title="Haz clic para ampliar la imagen"
                >
                  <div style={{
                    position: 'absolute', bottom: '12px', right: '12px',
                    backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff',
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    border: '1px solid rgba(255,255,255,0.12)', fontWeight: 'bold'
                  }}>
                    🔍 Ampliar imagen
                  </div>
                </div>
              )}
              {infoProductModal.info_adicional_texto && (
                <div style={{ padding: '24px' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: '15px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                    {infoProductModal.info_adicional_texto}
                  </p>
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => setInfoProductModal(null)} className="btn-landing-primary" style={{ width: '100%', padding: '12px', fontSize: '16px' }}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEN EXPANDIDA (TUTORIAL BANNER) */}
      {expandedImage && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 20005,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', backdropFilter: 'blur(10px)',
            cursor: 'zoom-out', animation: 'fadeIn 0.25s'
          }}
          onClick={() => setExpandedImage(null)}
        >
          <img 
            src={expandedImage} 
            alt="Expanded Preview" 
            style={{
              maxWidth: '100%', maxHeight: '95vh',
              borderRadius: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
              objectFit: 'contain', border: '1px solid rgba(255,255,255,0.08)',
              animation: 'scaleUp 0.25s'
            }}
          />
          <button
            style={{
              position: 'absolute', top: '24px', right: '24px',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', fontSize: '20px', width: '44px', height: '44px',
              borderRadius: '50%', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
            onClick={(e) => { e.stopPropagation(); setExpandedImage(null); }}
          >
            ✕
          </button>
        </div>
      )}


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

        /* Modal & CMS Styles */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10002;
          backdrop-filter: blur(8px);
          padding: 20px;
        }
        .modal-content.card-modern {
          background: var(--bg-card);
          border-radius: 24px;
          border: 1px solid var(--border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          position: relative;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }
        .close-btn {
          background: rgba(255,255,255,0.05);
          border: none;
          color: var(--text-main);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.2s;
        }
        .close-btn:hover {
          background: rgba(255,255,255,0.1);
          transform: rotate(90deg);
        }
        .rich-text-content {
          line-height: 1.8;
          color: var(--text-main);
        }
        .rich-text-content h1, .rich-text-content h2 { margin-top: 0; color: var(--accent); }
        .rich-text-content p { margin-bottom: 16px; }
        .rich-text-content ul { padding-left: 20px; margin-bottom: 16px; }

        .dark {
          --bg-page: #0f172a;
          --bg-card: #1e293b;
          --bg-header: #1e293b;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --border: #334155;
          --bg-hover: #334155;
        }

        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 0.8; }
          100% { opacity: 0.5; }
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
          align-items: center;
          gap: 24px;
        }
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .nav-link i {
          font-size: 12px;
          transition: transform 0.2s;
        }
        .nav-dropdown:hover .nav-link i {
          transform: rotate(180deg);
        }
        .nav-link:hover, .nav-link.active {
          color: var(--accent);
        }
        .wallet-page-wrapper {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 30px 20px;
        }
        @media (max-width: 768px) {
          .wallet-page-wrapper {
            padding: 10px 5px;
          }
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

        .btn-verify-prominent {
          background: linear-gradient(135deg, #00d2ff 0%, #7b2ff7 100%) !important;
          box-shadow: 0 4px 15px rgba(123, 47, 247, 0.4);
          border: none;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          color: white !important;
        }
        .btn-verify-prominent:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(123, 47, 247, 0.6);
          filter: brightness(1.1);
        }
        .btn-verify-prominent:active {
          transform: translateY(0);
        }

        /* FLOATING CHAT BUTTON */
        .floating-chat-btn {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 65px;
          height: 65px;
          border-radius: 50%;
          background: linear-gradient(135deg, #00d2ff 0%, #7b2ff7 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(123, 47, 247, 0.5);
          z-index: 9999;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border: 2px solid rgba(255, 255, 255, 0.2);
        }
        .floating-chat-btn:hover {
          transform: scale(1.15) rotate(10deg);
          box-shadow: 0 15px 40px rgba(123, 47, 247, 0.7);
        }
        .floating-chat-btn::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: inherit;
          z-index: -1;
          opacity: 0.5;
          animation: pulse-chat 2s infinite;
        }
        @keyframes pulse-chat {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        .support-chat-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10000;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 30px;
          pointer-events: none;
        }
        .support-chat-wrapper {
          width: 400px;
          height: 600px;
          max-height: calc(100vh - 120px);
          background: var(--bg-card);
          border-radius: 24px;
          box-shadow: 0 20px 80px rgba(0,0,0,0.6);
          overflow: hidden;
          pointer-events: auto;
          animation: slideUpChat 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
        }

        /* Ajustes para que el componente interno no cree sombras dobles */
        .support-chat-wrapper .support-chat-container,
        .support-chat-wrapper .support-chat-embedded-container {
          width: 100%;
          height: 100%;
          position: relative !important;
          bottom: auto !important;
          right: auto !important;
          z-index: 1 !important;
        }
        .support-chat-wrapper .support-chat-window {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        
        @keyframes slideUpChat {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @media (max-width: 600px) {
          .support-chat-overlay { padding: 0; }
          .support-chat-wrapper { 
            width: 100%; 
            height: 100%; 
            max-height: 100%; 
            border-radius: 0; 
          }
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
          padding: 10px 0;
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
          overflow: visible; /* Permitir que el gancho sobresalga */
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          transition: transform 0.3s, box-shadow 0.3s;
          cursor: pointer;
          position: relative;
          border: 1px solid var(--border);
          padding: 0;
          display: flex;
          flex-direction: column;
          margin-top: 25px; /* Espacio para el gancho */
          height: calc(100% - 25px); /* Restar margin-top para que cuadre perfecto en el grid */
        }
        .game-image-container {
          width: 100%;
          aspect-ratio: 1/1;
          overflow: hidden; /* El clipping se hace aquí */
          border-radius: 16px 16px 0 0;
          position: relative;
          flex-shrink: 0;
        }
        .game-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
          border-color: var(--accent);
        }
        .game-image {
          width: 100%;
          height: 100%;
          aspect-ratio: 1/1;
          object-fit: cover;
          display: block;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .game-card:hover .game-image {
          transform: scale(1.1);
        }
        .game-info {
          padding: 10px 12px 10px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          justify-content: center; /* Centrar el nombre verticalmente si es muy corto */
        }
        .game-name {
          font-weight: 600;
          font-size: 14px;
          display: -webkit-box;
          -webkit-line-clamp: 2; /* Limitar a 2 líneas */
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
          text-align: center;
        }
        .game-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .rating {
          color: #f59e0b;
          font-weight: 700;
        }
        .badge-discount {
          position: absolute;
          top: -22px; /* Completamente por encima */
          left: 0;
          background: linear-gradient(135deg, #ff4757 0%, #ff6b6b 100%);
          color: white;
          font-size: 8px;
          font-weight: 900;
          padding: 2px 7px;
          border-radius: 4px;
          z-index: 100;
          box-shadow: 0 4px 10px rgba(255, 71, 87, 0.3);
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.5px;
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
          margin-top: 0;
        }
        .breadcrumb {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 12px;
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
          gap: 12px;
        }
        .detail-header-area { grid-area: header; }
        .detail-sidebar-area { grid-area: sidebar; }
        .detail-content-area { grid-area: content; }

        .detail-header-card {
          background: var(--bg-card);
          padding: 12px 24px;
          border-radius: 20px;
          display: flex;
          gap: 24px;
          align-items: center;
          margin-bottom: 4px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid var(--border);
        }
        .detail-header-card.has-banner {
          display: block;
          padding: 0;
          overflow: hidden;
        }
        .detail-header-card.has-banner .detail-header-info {
          padding: 10px 24px;
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
          margin-bottom: 2px;
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
          padding: 12px;
          border-radius: 20px;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid var(--border);
        }
        .price-list-section h3 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
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
          padding: 12px;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          border: 1px solid var(--border);
        }
        .purchase-card h3 {
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 6px;
        }
        .purchase-card p {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .w-full { width: 100%; }
        .mb-12 { margin-bottom: 12px; }
        .sidebar-features {
          margin-top: 15px;
          padding-top: 15px;
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
          margin-bottom: 8px; 
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
          padding: 12px; 
          margin-bottom: 15px; 
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
          background: #0d1117;
          color: #8a9bb5;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .footer-grid-new {
          display: grid;
          grid-template-columns: 1.2fr 1.2fr 1fr;
          gap: 48px;
          align-items: start;
        }
        .footer-col-brand {}
        .footer-col-products {}
        .footer-col-social {}
        .footer-link-small {
          display: block;
          color: #8a9bb5;
          text-decoration: none;
          font-size: 13px;
          padding: 3px 0;
          transition: color 0.2s;
        }
        .footer-link-small:hover { color: #00d2ff; }
        .footer-product-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          overflow: hidden;
          width: 100%;
        }
        .footer-product-btn:hover {
          background: rgba(0, 210, 255, 0.08);
          border-color: rgba(0, 210, 255, 0.25);
          transform: translateY(-1px);
        }
        .footer-social-box {
          background: linear-gradient(135deg, rgba(var(--accent-rgb, 123,47,247), 0.15), rgba(0, 210, 255, 0.1));
          border: 1px solid rgba(0, 210, 255, 0.2);
          border-radius: 16px;
          padding: 20px;
        }
        .footer-social-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          background: rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #fff;
          text-decoration: none;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .footer-social-icon:hover {
          background: var(--sc, rgba(0,210,255,0.3));
          border-color: var(--sc, #00d2ff);
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        .footer-payment-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #c8d6e8;
          white-space: nowrap;
        }
        @media (max-width: 900px) {
          .footer-grid-new { grid-template-columns: 1fr 1fr; }
          .footer-col-social { grid-column: 1 / -1; }
        }
        @media (max-width: 600px) {
          .footer-grid-new { grid-template-columns: 1fr; gap: 32px; }
          .footer-col-social { grid-column: auto; }
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
      <div className="game-image-container">
        <img 
          src={juego.icono_url ? (juego.icono_url.includes('?') ? `${juego.icono_url}&v=3` : `${juego.icono_url}?v=3`) : 'https://via.placeholder.com/200x250?text=' + juego.nombre} 
          alt={juego.nombre} 
          className="game-image" 
          fetchpriority="high"
          loading="eager"
        />
      </div>
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
