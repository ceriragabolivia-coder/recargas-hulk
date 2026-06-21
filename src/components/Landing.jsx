import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom'
import PaginaEstatica from './PaginaEstatica'
import { supabase } from '../lib/supabase'
import { useConfiguracion, useAuth, useCart, useCuentasGuardadas, useMetodosPago, useWallet } from '../hooks/useData'
import { formatUSD, formatBs, calcularPrecioVenta, playClientOrderSuccessSound, playClientWelcomeSound, hasRole } from '../utils/helpers'
import LandingAuthModal from './LandingAuthModal'
import Checkout from './Checkout'
import Pedidos from './Pedidos'
import SupportChat from './SupportChat'
import LandingWallet from './LandingWallet'
import LandingPerfil from './LandingPerfil'
import Ruleta from './Ruleta'
import DOMPurify from 'dompurify'
import TutorialVideoModal from './TutorialVideoModal'
import FloatingBackground from './FloatingBackground'
import './Landing.css'
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
  const isRevendedor = hasRole(perfil, 'revendedor')
  
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
  
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'administrador';

  const hasWalletUSD = useMemo(() => {
    if (isAdmin) return true;
    if (perfil?.rol === 'revendedor') return !(perfil.config_modulos || []).includes('disable_wallet_usd');
    return (perfil?.config_modulos || []).includes('enable_wallet_usd');
  }, [isAdmin, perfil]);

  const hasWalletBs = useMemo(() => {
    if (isAdmin) return true;
    return !(perfil?.config_modulos || []).includes('disable_wallet_bs');
  }, [isAdmin, perfil]);
  const [showOrders, setShowOrders] = useState(false)
  const [showWallet, setShowWallet] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showRuleta, setShowRuleta] = useState(false)
  const [ordersParams, setOrdersParams] = useState(null)

  // Estados de Compra y Carrito
  const { cuentas, guardarCuenta, eliminarCuenta } = useCuentasGuardadas(selectedJuego?.id || null)
  const [buyMode, setBuyMode] = useState('single')
  const [localRechargeData, setLocalRechargeData] = useState({
    player_id: '', zone_id: '', account_email: '', account_password: '', account_user: '', cuentaOpcion: 'propia'
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
  const [quantity, setQuantity] = useState(1)
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  useEffect(() => {
    setQuantity(1)
  }, [pendingItem?.p?.id])

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
      account_user: '',
      cuentaOpcion: 'propia'
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
      account_user: cuenta.username || '',
      cuentaOpcion: 'propia'
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
    
    // Clonar el juego para evitar mutaciones indeseadas y resolver 'opcional_cuenta'
    let resolvedJuego = { ...selectedJuego }
    if (resolvedJuego.metodo_recarga === 'opcional_cuenta') {
      resolvedJuego.metodo_recarga = localRechargeData.cuentaOpcion === 'nueva' ? 'cuenta_nueva' : 'cuenta_completa'
    }

    if (buyMode === 'single') {
      clearCart() // Limpiar carrito antes de compra directa
      addToCart(p, resolvedJuego, finalPrice, localRechargeData)

      if (shouldSaveData && localRechargeData.cuentaOpcion !== 'nueva') {
        await guardarCuenta({
          tipo_dato: resolvedJuego.metodo_recarga || 'id',
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
      addToCart(p, resolvedJuego, finalPrice, localRechargeData)
      
      if (shouldSaveData && localRechargeData.cuentaOpcion !== 'nueva') {
        await guardarCuenta({
          tipo_dato: resolvedJuego.metodo_recarga || 'id',
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
    if (config?.landing_featured_games && config.landing_featured_games !== '0' && config.landing_featured_games.trim() !== '') {
      const ids = config.landing_featured_games.split(',').map(id => id.trim())
      const filtered = juegos.filter(j => ids.includes(String(j.id)))
      if (filtered.length > 0) return filtered
    }
    return juegos // Mostrar todos los juegos en lugar de limitar a 20
  }, [juegos, config])

  // TRACKING DE VISITAS
  const trackingDebounceRef = React.useRef(null)
  useEffect(() => {
    let item_nombre = 'Home'
    let item_tipo = 'pagina'

    if (showRuleta) {
      item_nombre = 'Ruleta'
      item_tipo = 'servicio'
    } else if (showCheckout) {
      item_nombre = 'Checkout'
      item_tipo = 'pagina'
    } else if (showOrders) {
      item_nombre = 'Mis Pedidos'
      item_tipo = 'pagina'
    } else if (showWallet) {
      item_nombre = 'Billetera'
      item_tipo = 'pagina'
    } else if (showProfile) {
      item_nombre = 'Mi Perfil'
      item_tipo = 'pagina'
    } else if (slug) {
      item_nombre = `Página: ${slug}`
      item_tipo = 'pagina'
    } else if (selectedJuego) {
      item_nombre = selectedJuego.nombre
      item_tipo = 'juego'
    }

    if (trackingDebounceRef.current) clearTimeout(trackingDebounceRef.current);
    
    trackingDebounceRef.current = setTimeout(async () => {
      // Excluir administradores de las estadísticas para no ensuciar los datos
      if (perfil?.rol === 'admin' || perfil?.rol === 'administrador') return;

      try {
        await supabase.from('visitas_tracking').insert([{
          item_nombre,
          item_tipo,
          user_id: user?.id || null,
          is_guest: !user
        }]);
      } catch (e) {
        // Error silencioso, el tracking no debe afectar al usuario
      }
    }, 2000); // Requiere permanecer al menos 2 segundos en la vista
  }, [showRuleta, showCheckout, showOrders, showWallet, showProfile, slug, selectedJuego, user?.id, perfil?.rol]);

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
      <FloatingBackground />
      
      {/* DINAMIC CSS THEME VARIABLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-page: ${config?.landing_bg_color || '#0f0f10'};
          --bg-card: ${config?.landing_card_bg || '#1a1d21'};
          --bg-header: ${config?.landing_bg_color || '#0f0f10'};
          --text-main: ${config?.landing_text_main || '#ffffff'};
          --text-muted: ${config?.landing_text_muted || '#a1a1aa'};
          --border: ${config?.landing_border_color || '#27272a'};
          --bg-hover: rgba(255, 255, 255, 0.03);
          --accent: ${config?.landing_accent_color || '#a3e635'};
          --accent-light: ${config?.landing_accent_color || '#a3e635'}1a;
        }
      `}} />

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
              <span className="landing-logo-text">{config?.landing_titulo || 'Recargas Hulk'}</span>
            </div>
            
            <nav className="landing-nav hidden-mobile">
              <a href="#" className="nav-link active" onClick={(e) => { e.preventDefault(); handleSelectJuego(null); }}>Home</a>
              {!isRevendedor && (
                <a href="#" className={`nav-link ${showRuleta ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/Ruleta'); }}>Ruleta</a>
              )}
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
            
            {/* BILLETERA */}
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
                {hasWalletUSD && (
                  <>
                    <span style={{ fontSize: '18px' }}>💵</span>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--accent-success)', whiteSpace: 'nowrap' }}>
                      {formatUSD(wallet?.saldo || 0)}
                    </span>
                  </>
                )}
                {!hasWalletUSD && hasWalletBs && (
                  <>
                    <span style={{ fontSize: '18px' }}>🏦</span>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#a855f7', whiteSpace: 'nowrap' }}>
                      {formatBs(wallet?.saldo_bs || 0)}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* CARRITO */}
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

            {/* CAMPANA DE NOTIFICACIONES */}
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
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
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
                  {!isRevendedor && (
                    <a href="#" className="visible-mobile" onClick={(e) => { e.preventDefault(); navigate('/Ruleta'); }}>Ruleta</a>
                  )}
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
        {/* HERO SLIDER */}
        {!slug && !selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && !search.trim() && config?.landing_show_hero !== '0' && (
          <section className="landing-hero landing-container">
            {!config ? (
              <div className="hero-slider skeleton-loader" style={{ height: '320px', background: 'var(--bg-hover)', borderRadius: '24px', opacity: 0.3, animation: 'pulse 1.5s infinite' }}></div>
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

        {/* RECENT PURCHASES TICKER */}
        {!slug && !selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && !search.trim() && (
          <div className="marquee-container">
            <div className="marquee-content">
              <span className="marquee-item">⚡ COMPRA: <span>AND*** acaba de recargar 100 + 10 Diamantes Free Fire</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>PED*** acaba de recargar 500 Diamantes BloodStrike</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>MAR*** acaba de recargar $10 Apple Gift Card USA</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>JUA*** acaba de recargar Pase Semanal Free Fire</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>YUL*** acaba de recargar 310 Diamantes Free Fire</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>LUF*** acaba de recargar $5 Razer Gold PIN</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>ELI*** acaba de recargar 50 Diamantes BloodStrike</span></span>
              <span className="marquee-item">⚡ COMPRA: <span>CAR*** acaba de recargar $10 Roblox Gift Card</span></span>
            </div>
          </div>
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
        ) : (showRuleta && !isRevendedor) ? (
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

              {/* SIDEBAR DE COMPRA */}
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
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent)', color:'#000', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
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
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent)', color:'#000', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
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
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent)', color:'#000', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'bold' }} title="Ver guía">?</div>
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
                          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 200px' }}>
                              <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                👤 Nombre de usuario
                                {selectedJuego.guia_id_url && (
                                  <span 
                                    onClick={() => setShowGuideModal(true)}
                                    style={{ 
                                      cursor: 'pointer', backgroundColor: 'var(--accent)', color: '#000', 
                                      width: '18px', height: '18px', borderRadius: '50%', display: 'flex', 
                                      alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' 
                                    }}
                                    title="Ver dónde obtener esta información"
                                  >?</span>
                                )}
                              </label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Tu nombre de usuario en el juego"
                                value={localRechargeData.account_user || ''}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_user: e.target.value})}
                                style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                              />
                            </div>
                            <div style={{ flex: '1 1 200px' }}>
                              <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>
                                🔑 Contraseña
                              </label>
                              <input 
                                type="password" 
                                className="form-input" 
                                placeholder="********"
                                value={localRechargeData.account_password}
                                onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                                style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                              />
                            </div>
                          </div>
                        ) : effectiveMetodoRecarga === 'opcional_cuenta' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                               <button 
                                  onClick={() => setLocalRechargeData({...localRechargeData, cuentaOpcion: 'propia'})}
                                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid ' + (localRechargeData.cuentaOpcion === 'propia' ? 'var(--accent)' : 'var(--border)'), backgroundColor: localRechargeData.cuentaOpcion === 'propia' ? 'var(--accent-light)' : 'var(--bg-card)', color: localRechargeData.cuentaOpcion === 'propia' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                               >🏠 Activar en mi propia cuenta</button>
                               <button 
                                  onClick={() => setLocalRechargeData({...localRechargeData, cuentaOpcion: 'nueva'})}
                                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid ' + (localRechargeData.cuentaOpcion === 'nueva' ? 'var(--accent)' : 'var(--border)'), backgroundColor: localRechargeData.cuentaOpcion === 'nueva' ? 'var(--accent-light)' : 'var(--bg-card)', color: localRechargeData.cuentaOpcion === 'nueva' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                               >✨ Quiero una cuenta nueva</button>
                            </div>
                            {localRechargeData.cuentaOpcion === 'propia' ? (
                              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', animation: 'fadeIn 0.3s' }}>
                                   <div style={{ flex: '1 1 200px' }}>
                                     <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>📧 Correo de la cuenta</label>
                                     <input type="email" className="form-input" placeholder="ejemplo@correo.com" value={localRechargeData.account_email} onChange={e => setLocalRechargeData({...localRechargeData, account_email: e.target.value})} style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }} />
                                   </div>
                                   <div style={{ flex: '1 1 200px' }}>
                                     <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>🔑 Clave de acceso</label>
                                     <input type="password" className="form-input" placeholder="********" value={localRechargeData.account_password} onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})} style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }} />
                                   </div>
                              </div>
                            ) : (
                              <div style={{ padding: '16px', backgroundColor: 'var(--accent-light)', borderRadius: '12px', border: '1px dashed var(--accent)', textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                                 <div style={{ fontSize: '24px', marginBottom: '8px' }}>📺</div>
                                 <p style={{ color: 'var(--accent)', fontWeight: 'bold', margin: '0 0 4px 0', fontSize: '16px' }}>Nosotros te proveeremos una cuenta</p>
                                 <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>No necesitas ingresar ningún dato. Una vez procesado el pedido, te enviaremos el correo y la contraseña de tu nueva cuenta con el servicio activado.</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>🆔 ID del Jugador</label>
                                {selectedJuego?.guia_id_url && (
                                  <div onClick={() => setExpandedImage(selectedJuego.guia_id_url)} style={{ cursor:'pointer', background:'var(--accent)', color:'#000', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'bold' }} title="Ver guía">?</div>
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
                      border: '1px solid var(--accent)',
                      background: 'var(--bg-card)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {selectedJuego.tutorial_banner_img ? (
                      <img src={selectedJuego.tutorial_banner_img} alt="Tutorial" style={{ width: '100%', display: 'block' }} />
                    ) : (
                      <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--accent-light)' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0
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
                                      backgroundColor: currentViewType === 'recarga' ? 'var(--accent-light)' : 'transparent',
                                      color: currentViewType === 'recarga' ? 'var(--accent)' : 'var(--text-muted)',
                                      border: currentViewType === 'recarga' ? '1px solid var(--accent)' : '1px solid var(--border)',
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
                                      backgroundColor: currentViewType === 'paquete' ? 'var(--accent-light)' : 'transparent',
                                      color: currentViewType === 'paquete' ? 'var(--accent)' : 'var(--text-muted)',
                                      border: currentViewType === 'paquete' ? '1px solid var(--accent)' : '1px solid var(--border)',
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
                                      backgroundColor: currentViewType === 'gift_card' ? 'var(--accent-light)' : 'transparent',
                                      color: currentViewType === 'gift_card' ? 'var(--accent)' : 'var(--text-muted)',
                                      border: currentViewType === 'gift_card' ? '1px solid var(--accent)' : '1px solid var(--border)',
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
                                const isSelected = pendingItem?.p?.id === prod.id;
                                return (
                                  <div 
                                    key={prod.id} 
                                    className={`product-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
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
                                    }}
                                  >
                                    {/* CASHBACK BADGE */}
                                    {(config?.cashback_activo === 'true' || config?.cashback_activo === '1') && (
                                      <div className="product-cashback-badge">
                                        ⚡ +{config?.cashback_porcentaje || '0'}% Cashback
                                      </div>
                                    )}
                                    
                                    {prod.icono_url && <img src={prod.icono_url.includes('?') ? `${prod.icono_url}&v=3` : `${prod.icono_url}?v=3`} alt="" className="product-icon" />}
                                    <div className="product-name">{prod.nombre}</div>
                                    <div className="product-price">
                                      <span className="price-primary">{formatBs(pricing.venta_bs)}</span>
                                      {selectedJuego.mostrar_precio_dual && (
                                        <span className="price-secondary-usd">{formatUSD(pricing.venta_usd)}</span>
                                      )}
                                    </div>
                                    
                                    {(prod.info_adicional_texto || prod.info_adicional_imagen_url) && (
                                      <div 
                                        onClick={(e) => { e.stopPropagation(); setInfoProductModal(prod); }} 
                                        className="product-info-trigger"
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
          </div>
        ) : (
          /* VISTA CATALOGO PRINCIPAL */
          <>
            {/* BESTSELLERS / DESTACADOS */}
            {!search.trim() && activeCategory === 'Todos' && config?.landing_show_bestsellers !== '0' && (
              <section className="landing-section landing-container">
                <div className="section-header">
                  <h3>Recarga Aquí</h3>
                  <a href="#all-games" className="view-all" onClick={(e) => { e.preventDefault(); const el = document.getElementById('all-games'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>Ver todos &gt;</a>
                </div>
                <div className="games-grid">
                  {loading ? (
                    Array(8).fill(0).map((_, i) => (
                      <div key={i} className="game-card-skeleton" style={{ height: '220px', backgroundColor: 'var(--bg-hover)', borderRadius: '12px', opacity: 0.5, animation: 'pulse 1.5s infinite' }}></div>
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

            {/* SECCIÓN PRINCIPAL: SLIDERS O GRILLA FILTRADA */}
            {(!search.trim() && activeCategory === 'Todos' && config?.landing_show_sliders !== '0') ? (
              /* VISTA DE SLIDERS HORIZONTALES (ESTILO CONECTA2VE) */
              <div className="landing-sliders-catalog" id="all-games">
                {categorias.map(cat => {
                  const catGames = juegos.filter(j => j.categoria_id === cat.id || j.categorias?.nombre === cat.nombre);
                  if (catGames.length === 0) return null;
                  
                  return (
                    <section key={cat.id} className="landing-section landing-container">
                      <div className="section-header">
                        <h3>{cat.nombre}</h3>
                      </div>
                      <div className="slider-row">
                        {catGames.map(juego => (
                          <div key={juego.id} style={{ minWidth: '180px', maxWidth: '180px' }}>
                            <GameCard juego={juego} onSelect={() => handleSelectJuego(juego)} />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              /* VISTA CLÁSICA CON SELECTOR Y REJILLA */
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
                        height: '220px', 
                        backgroundColor: 'rgba(255,255,255,0.05)', 
                        borderRadius: '12px', 
                        overflow: 'hidden',
                        position: 'relative',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ height: '75%', background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s infinite' }}></div>
                        <div style={{ padding: '10px 15px', background: '#000000', height: '25%' }}>
                          <div style={{ height: '12px', width: '80%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', margin: '4px auto 0', animation: 'pulse 1.5s infinite' }}></div>
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
            )}

            {/* SECCIÓN DE BENEFICIOS (PITCH) */}
            {!slug && !selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && config?.landing_show_benefits !== '0' && (
              <section className="landing-section landing-container" style={{ marginTop: '50px' }}>
                <div className="section-header" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column', borderLeft: 'none', paddingLeft: 0, marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800 }}>¿Por qué elegir {config?.landing_titulo || 'Recargas Hulk'}?</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>La mejor plataforma de recargas en Venezuela</p>
                </div>
                <div className="benefits-grid">
                  {(() => {
                    let benefits = [];
                    try {
                      if (config?.landing_benefits_json) {
                        benefits = JSON.parse(config.landing_benefits_json);
                      }
                    } catch(e) {}
                    if (benefits.length === 0) {
                      benefits = [
                        {id: 1, icon: "⚡", title: "Entrega en 1-5 Minutos", desc: "La mayoría de las recargas se procesan de manera automatizada y se entregan al instante."},
                        {id: 2, icon: "🛡️", title: "Verificación Segura", desc: "Validamos el ID del jugador antes de que completes el pago para evitar errores."},
                        {id: 3, icon: "💳", title: "Múltiples Métodos de Pago", desc: "Aceptamos Pago Móvil, Binance Pay, Zelle y transferencias en Bolívares."},
                        {id: 4, icon: "🤖", title: "Servicio 24/7", desc: "Nuestra plataforma está disponible las 24 horas del día, los 7 días de la semana."}
                      ];
                    }
                    return benefits;
                  })().map(b => (
                    <div key={b.id} className="benefit-card">
                      <div className="benefit-icon">{b.icon}</div>
                      <h4 className="benefit-title">{b.title}</h4>
                      <p className="benefit-desc">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECCIÓN DE RESEÑAS / TESTIMONIOS */}
            {!slug && !selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && config?.landing_show_reviews !== '0' && (
              <section className="landing-section landing-container" style={{ marginTop: '50px' }}>
                <div className="section-header" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column', borderLeft: 'none', paddingLeft: 0, marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Lo que dicen nuestros clientes</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Opiniones 100% reales y verificadas</p>
                </div>
                <div className="reviews-row">
                  {(() => {
                    let reviews = [];
                    try {
                      if (config?.landing_reviews_json) {
                        reviews = JSON.parse(config.landing_reviews_json);
                      }
                    } catch(e) {}
                    if (reviews.length === 0) {
                      reviews = [
                        {id: 1, name: "Carlos M.", rating: 5, comment: "Excelente servicio, la recarga de Free Fire llegó en menos de 2 minutos. Muy recomendado!"},
                        {id: 2, name: "Andrea G.", rating: 5, comment: "La verificación del ID evita errores. Es la mejor página de recargas en Venezuela."},
                        {id: 3, name: "Luis P.", rating: 5, comment: "Rápido y seguro. Pagué con Pago Móvil y fue instantáneo."}
                      ];
                    }
                    return reviews;
                  })().map(r => (
                    <div key={r.id} className="review-card">
                      <div className="review-stars">{"★".repeat(r.rating || 5)}{"☆".repeat(5 - (r.rating || 5))}</div>
                      <p className="review-comment">"{r.comment}"</p>
                      <h5 className="review-name">- {r.name}</h5>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECCIÓN DE PREGUNTAS FRECUENTES (FAQs) */}
            {!slug && !selectedJuego && !showCheckout && !showOrders && !showRuleta && !showWallet && !showProfile && config?.landing_show_faq !== '0' && (
              <section className="landing-section landing-container" style={{ marginTop: '50px', marginBottom: '40px' }}>
                <div className="section-header" style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column', borderLeft: 'none', paddingLeft: 0, marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Preguntas Frecuentes</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Resuelve tus dudas al instante</p>
                </div>
                <div className="faq-accordion" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    let faqs = [];
                    try {
                      if (config?.landing_faq_json) {
                        faqs = JSON.parse(config.landing_faq_json);
                      }
                    } catch(e) {}
                    if (faqs.length === 0) {
                      faqs = [
                        {id: 1, question: "¿Cuánto tiempo tarda en llegar mi recarga?", answer: "La mayoría de las recargas se procesan de manera automática y se entregan en un lapso de 1 a 5 minutos."},
                        {id: 2, question: "¿Qué métodos de pago aceptan?", answer: "Aceptamos Pago Móvil, Binance Pay, Zelle y transferencias en Bolívares."},
                        {id: 3, question: "¿Qué pasa si introduzco un ID de jugador incorrecto?", answer: "Gracias a nuestro sistema de verificación de ID, validamos el nombre del jugador antes de que completes el pago, evitando que pierdas tu dinero."}
                      ];
                    }
                    return faqs;
                  })().map((faq, idx) => (
                    <div key={faq.id || idx} className="faq-item">
                      <div 
                        className="faq-question" 
                        onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                      >
                        <span>{faq.question}</span>
                        <span>▼</span>
                      </div>
                      {openFaqIndex === idx && (
                        <div className="faq-answer">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* TEXTO SEO */}
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
                <span className="landing-logo-text">{config?.landing_titulo || 'Recargas Hulk'}</span>
              </div>
            </div>

            {/* Col 2: Productos */}
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
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#5a6a7e', margin: 0 }}>
            © {new Date().getFullYear()} {config?.landing_titulo || 'Recargas Hulk'}. Todos los derechos reservados.
            {paginasFooter.filter(p => p.categoria === 'Empresa').map(p => (
              <span key={p.id}>
                {' · '}
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('p/' + p.slug); }} style={{ color: '#5a6a7e', textDecoration: 'none' }} onMouseEnter={e => e.target.style.color='#00d2ff'} onMouseLeave={e => e.target.style.color='#5a6a7e'}>{p.titulo}</a>
              </span>
            ))}
          </p>
        </div>
      </footer>

      {/* STICKY BOTTOM PURCHASE BAR */}
      {pendingItem && (
        <div className="sticky-purchase-bar">
          <div className="sticky-purchase-inner">
            <div className="sticky-product-details">
              {pendingItem.p.icono_url ? (
                <img src={pendingItem.p.icono_url} alt="" className="sticky-product-icon" />
              ) : (
                <span className="sticky-placeholder-icon">💎</span>
              )}
              <div className="sticky-product-info">
                <div className="sticky-product-title">{pendingItem.p.nombre}</div>
                <div className="sticky-product-price">
                  {formatBs(pendingItem.finalPrice.venta_bs * quantity)}
                  {selectedJuego.mostrar_precio_dual && (
                    <span className="sticky-price-usd"> ({formatUSD(pendingItem.finalPrice.venta_usd * quantity)})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky-actions-container">
              <div className="sticky-quantity-selector">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => q + 1)}>+</button>
              </div>
              
              <div className="sticky-button-group">
                <button 
                  type="button"
                  className="btn-sticky-cart"
                  onClick={() => {
                    for (let i = 0; i < quantity; i++) {
                      addToCart(pendingItem.p, selectedJuego, pendingItem.finalPrice, pendingItem.localRechargeData)
                    }
                    setAddedItem(pendingItem.p.id)
                    setTimeout(() => setAddedItem(null), 1200)
                    setPendingItem(null)
                    resetRechargeForm()
                  }}
                >
                  🛒 Añadir
                </button>
                <button 
                  type="button"
                  className="btn-sticky-buy"
                  onClick={async () => {
                    clearCart()
                    for (let i = 0; i < quantity; i++) {
                      addToCart(pendingItem.p, selectedJuego, pendingItem.finalPrice, pendingItem.localRechargeData)
                    }
                    if (shouldSaveData && pendingItem.localRechargeData.cuentaOpcion !== 'nueva') {
                      await guardarCuenta({
                        tipo_dato: selectedJuego.metodo_recarga || 'id',
                        player_id: pendingItem.localRechargeData.player_id,
                        zone_id: pendingItem.localRechargeData.zone_id,
                        email: pendingItem.localRechargeData.account_email,
                        password: pendingItem.localRechargeData.account_password,
                        username: pendingItem.localRechargeData.account_user,
                        nombre_perfil: pendingItem.localRechargeData.player_id || pendingItem.localRechargeData.account_email || pendingItem.localRechargeData.account_user || 'Cuenta'
                      })
                    }
                    setPendingItem(null)
                    resetRechargeForm()
                    setShowCheckout(true)
                    window.scrollTo(0, 0)
                  }}
                >
                  Comprar ahora 🚀
                </button>
                <button type="button" className="btn-sticky-close" onClick={() => setPendingItem(null)} title="Cerrar selección">✕</button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* CHAT DE SOPORTE */}
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

      {/* MODAL DE INFO ADICIONAL */}
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

      {/* LIGHTBOX DE IMAGEN EXPANDIDA */}
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
        /* Estilos Conecta2VE */
        .marquee-container { width: 100%; overflow: hidden; background: var(--bg-hover); padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .marquee-content { display: flex; animation: marquee 30s linear infinite; gap: 40px; }
        .marquee-item { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
        .marquee-item span { color: var(--text-main); font-weight: 600; }
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        
        .sticky-purchase-bar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 10000; background: var(--bg-card); padding: 16px; border-top: 1px solid var(--border); box-shadow: 0 -10px 20px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; animation: slideUp 0.3s; }
        .sticky-purchase-inner { width: 100%; max-width: 800px; display: flex; justify-content: space-between; align-items: center; }
        .sticky-product-details { display: flex; align-items: center; gap: 12px; }
        .sticky-product-icon { width: 40px; height: 40px; border-radius: 8px; }
        .sticky-product-title { font-weight: 800; font-size: 14px; }
        .sticky-product-price { color: var(--accent); font-weight: 900; font-size: 16px; }
        .sticky-actions-container { display: flex; align-items: center; gap: 16px; }
        .sticky-quantity-selector { display: flex; align-items: center; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border); }
        .sticky-quantity-selector button { border: none; background: transparent; padding: 8px 12px; cursor: pointer; color: var(--text-main); }
        .sticky-button-group { display: flex; gap: 8px; }
        .btn-sticky-cart { padding: 10px 20px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text-main); font-weight: 600; cursor: pointer; }
        .btn-sticky-buy { padding: 10px 20px; border-radius: 8px; border: none; background: var(--accent); color: #000; font-weight: 800; cursor: pointer; }
        
        .product-cashback-badge { position: absolute; top: 10px; left: 10px; background: #000; color: var(--accent); font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--accent); font-weight: 800; z-index: 2; }
        .product-info-trigger { position: absolute; top: 10px; right: 10px; background: var(--border); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; cursor: pointer; }
        
        .landing-sliders-catalog { display: flex; flex-direction: column; gap: 30px; }
        .slider-row { display: flex; gap: 16px; overflow-x: auto; padding: 10px 0; scrollbar-width: none; }
        .slider-row::-webkit-scrollbar { display: none; }
        
        .benefits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .benefit-card { background: var(--bg-card); padding: 24px; border-radius: 16px; border: 1px solid var(--border); text-align: center; }
        .benefit-icon { font-size: 32px; margin-bottom: 12px; }
        .benefit-title { font-weight: 800; margin-bottom: 8px; }
        .benefit-desc { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
        
        .reviews-row { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 10px; }
        .review-card { min-width: 300px; background: var(--bg-card); padding: 20px; border-radius: 16px; border: 1px solid var(--border); }
        .review-stars { color: #f59e0b; margin-bottom: 8px; }
        .review-comment { font-style: italic; color: var(--text-muted); font-size: 14px; margin-bottom: 12px; }
        .review-name { font-weight: 800; }
        
        .faq-item { background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }
        .faq-question { padding: 16px; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .faq-answer { padding: 0 16px 16px; color: var(--text-muted); font-size: 14px; line-height: 1.6; }
      `}} />
    </div>
  )
}

function GameCard({ juego, onSelect }) {
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
      </div>
    </div>
  )
}
