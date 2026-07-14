import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useCart, useVentas, useMetodosPago, useAuth, useWallet } from '../hooks/useData'
import { formatUSD, formatBs, playCashRegisterSound } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import { useConfiguracion } from '../hooks/useData'
import AlertModal from './AlertModal'
import FloatingBackground from './FloatingBackground'
import { compressImage } from '../utils/imageCompression'

// ============================================================
// CountdownTimer - FUERA del componente Checkout
// Si se define dentro, React lo recreará en cada render causando parpadeo
// ============================================================
function CountdownTimer({ expiryDate, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const distance = new Date(expiryDate).getTime() - Date.now()
    return distance > 0 ? Math.floor(distance / 1000) : 0
  })

  useEffect(() => {
    if (timeLeft <= 0) return
    const interval = setInterval(() => {
      const distance = new Date(expiryDate).getTime() - Date.now()
      if (distance <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        onExpire()
      } else {
        setTimeLeft(Math.floor(distance / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiryDate, onExpire])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (timeLeft <= 0) return null

  return (
    <div style={{ 
      padding: '12px', borderRadius: '12px',
      backgroundColor: timeLeft < 60 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 210, 255, 0.05)',
      border: `1px solid ${timeLeft < 60 ? '#ef4444' : 'var(--accent-primary)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px'
    }}>
      <span style={{ fontSize: '18px' }}>⏱️</span>
      <span style={{ fontWeight: 800, fontSize: '14px', color: timeLeft < 60 ? '#ef4444' : 'var(--accent-primary)' }}>
        Tiempo para reportar: <span style={{ fontSize: '20px', fontFamily: 'monospace' }}>{formatTime(timeLeft)}</span>
      </span>
    </div>
  )
}

export default function Checkout({ onFinish, embedded = false }) {
  const { cart, removeFromCart, clearCart, checkout, totalUSD, totalBs, validateCartPrices } = useCart()
  const { registrarVenta, verificarYRegistrarReferencia } = useVentas()
  const { metodos, cancelarPedidosExpirados, loading: loadingMetodos } = useMetodosPago()
  
  const metodosDisponibles = useMemo(() => {
    return metodos.filter(m => m.activo);
  }, [metodos]);
  const { perfil, user, isCliente, refreshPerfil } = useAuth()
  const { wallet } = useWallet()
  const { config } = useConfiguracion()

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
  
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedMetodoId, setSelectedMetodoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [useWalletPartial, setUseWalletPartial] = useState(false) // Toggle para usar saldo USD
  const [useWalletBs, setUseWalletBs] = useState(false) // Toggle para usar saldo Bs
  const [useRuletaDesc, setUseRuletaDesc] = useState(false) // Toggle para usar descuento de ruleta
  const [cuponInput, setCuponInput] = useState('')
  const [activeCupon, setActiveCupon] = useState(null)
  const [creadorDescuento, setCreadorDescuento] = useState(null)
  const [validatingCupon, setValidatingCupon] = useState(false)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderFinished, setOrderFinished] = useState(false)
  const [createdPedidoId, setCreatedPedidoId] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [darkMode, setDarkMode] = useState(true)
  const [currentBanner, setCurrentBanner] = useState(0)
  const orderPreparingRef = React.useRef(false)
  const [comprobanteUrl, setComprobanteUrl] = useState(null)
  const [uploadingComprobante, setUploadingComprobante] = useState(false)
  const [isAutomaticResult, setIsAutomaticResult] = useState(false)
  const [createdPedidoData, setCreatedPedidoData] = useState(null)
  const [showTracking, setShowTracking] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const [notificaciones, setNotificaciones] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotiDropdown, setShowNotiDropdown] = useState(false)

  // Banners (igual que Landing.jsx)
  const banners = useMemo(() => {
    if (config?.landing_banners_json) {
      try {
        const parsed = JSON.parse(config.landing_banners_json)
        if (parsed && parsed.length > 0) {
          const activeBanners = parsed.filter(b => b.active !== false)
          return activeBanners.length > 0 ? activeBanners : parsed
        }
      } catch (e) {}
    }
    return [
      {
        id: 1,
        image: config?.landing_banner_1 || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070',
        title: config?.landing_banner_1_title ?? config?.landing_subtitulo ?? '¡Recargas al Instante!',
        interval: config?.landing_banner_1_interval || '5'
      },
      {
        id: 2,
        image: config?.landing_banner_2 || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071',
        title: config?.landing_banner_2_title ?? 'Los mejores precios del mercado',
        interval: config?.landing_banner_2_interval || '5'
      },
      {
        id: 3,
        image: config?.landing_banner_3 || 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=2070',
        title: config?.landing_banner_3_title ?? 'Explora nuestro catálogo',
        interval: config?.landing_banner_3_interval || '5'
      }
    ]
  }, [config])

  // Auto-rotación de banners
  useEffect(() => {
    if (!banners || banners.length <= 1) return
    const interval = parseInt(banners[currentBanner]?.interval || '5') * 1000
    const timer = setTimeout(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length)
    }, interval)
    return () => clearTimeout(timer)
  }, [currentBanner, banners])


  // Notificaciones del usuario (igual que Landing)
  useEffect(() => {
    const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id
    if (!targetUserId) return
    const fetchNoti = async () => {
      const { data } = await supabase
        .from('notificaciones_usuarios')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) {
        const couponCodes = data
          .map(n => {
            const isCoupon = n.titulo === '¡Te han regalado un cupón! 🎁' || n.tipo === 'cupon';
            if (isCoupon) {
              const match = n.mensaje.match(/código:\s*([A-Za-z0-9_-]+)/i);
              return match ? match[1] : (n.metadata?.codigo || null);
            }
            return null;
          })
          .filter(Boolean);

        let validNotis = data;
        
        if (couponCodes.length > 0) {
          const { data: activeCoupons } = await supabase
            .from('cupones')
            .select('codigo')
            .in('codigo', couponCodes)
            .eq('activo', true)
            .or(`fecha_fin.is.null,fecha_fin.gt.${new Date().toISOString()}`);

          const activeCouponCodes = new Set(activeCoupons?.map(c => c.codigo) || []);

          validNotis = data.filter(n => {
            const isCoupon = n.titulo === '¡Te han regalado un cupón! 🎁' || n.tipo === 'cupon';
            if (isCoupon) {
              const match = n.mensaje.match(/código:\s*([A-Za-z0-9_-]+)/i);
              const code = match ? match[1] : (n.metadata?.codigo);
              if (code && !activeCouponCodes.has(code)) {
                return false;
              }
            }
            return true;
          });
        }
        
        validNotis = validNotis.slice(0, 10);
        
        setNotificaciones(validNotis)
        setUnreadCount(validNotis.filter(n => !n.leido).length)
      }
    }
    fetchNoti()
  }, [user, perfil])

  const markNotiAsRead = async (id) => {
    await supabase.from('notificaciones_usuarios').update({ leido: true }).eq('id', id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  // Validar los precios del carrito cuando se abre el checkout o cambia la tasa/configuración
  useEffect(() => {
    let mounted = true;
    if (cart.length > 0 && config) {
      validateCartPrices(config, perfil).then(changed => {
        if (mounted && changed) {
          if (currentStep !== 1) setCurrentStep(1);
          setAlertModal({ 
            type: 'warning', 
            title: 'Precios Actualizados',
            message: 'Los precios de algunos productos en tu carrito han sido actualizados según la tasa de cambio o precio actual vigente.\n\nPor favor, verifica el nuevo monto total antes de continuar.' 
          });
        }
      });
    }
    return () => { mounted = false; };
  }, [config, perfil, currentStep]); // Dependencia currentStep para poder resetearlo si estamos en paso > 1

  useEffect(() => {
    window.scrollTo(0, 0);
    const mainElement = document.querySelector('.main-content');
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentStep]);

  // Descuentos ganados en la ruleta (pendientes de usar)
  const [ruletaDescuentos, setRuletaDescuentos] = useState([])
  const [selectedRuletaDesc, setSelectedRuletaDesc] = useState(null)
  
  useEffect(() => {
    // Cerramos el checkout si el carrito se queda vacío de forma manual
    if (!orderFinished && !isProcessing && cart.length === 0 && currentStep === 1 && !createdPedidoData) {
      onFinish();
    }
  }, [cart, orderFinished, isProcessing, onFinish, currentStep, createdPedidoData]);

  useEffect(() => {
    const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id
    if (!targetUserId) return

    const fetchDiscounts = async () => {
      const { data, error } = await supabase
        .from('ruleta_descuentos_pendientes')
        .select('id,nombre,porcentaje')
        .eq('cliente_id', targetUserId)
        .eq('usado', false)
        .order('created_at', { ascending: false })
      
      if (!error) {
        setRuletaDescuentos(data || [])
      }
    }

    fetchDiscounts()

    const channel = supabase
      .channel(`ruleta_desc_${targetUserId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ruleta_descuentos_pendientes',
        filter: `cliente_id=eq.${targetUserId}`
      }, () => {
        fetchDiscounts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, perfil?.id, perfil?.cliente_uuid])

  useEffect(() => {
    const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id
    if (!targetUserId) return

    const fetchCreadorDesc = async () => {
      const { data: userData } = await supabase.from('clientes').select('creador_codigo_id, compras_con_codigo_creador').eq('auth_user_id', targetUserId).single()
      if (userData && userData.creador_codigo_id) {
        const { data: codeData } = await supabase.from('codigos_creadores').select('*').eq('id', userData.creador_codigo_id).single()
        if (codeData && codeData.activo && userData.compras_con_codigo_creador < codeData.compras_con_descuento_por_usuario) {
          setCreadorDescuento(codeData)
        }
      }
    }
    fetchCreadorDesc()
  }, [user?.id, perfil?.id, perfil?.cliente_uuid])

  const walletSaldo = wallet?.saldo || 0
  const walletSaldoBs = wallet?.saldo_bs || 0

  const activeRuletaDesc = useRuletaDesc ? selectedRuletaDesc : null
  const ruletaFactor = activeRuletaDesc ? (1 - activeRuletaDesc.porcentaje / 100) : 1
  const cuponFactor = activeCupon ? (1 - activeCupon.porcentaje_descuento / 100) : 1
  const creadorFactor = creadorDescuento ? (1 - creadorDescuento.porcentaje_descuento / 100) : 1
  const finalCuponFactor = creadorDescuento ? creadorFactor : cuponFactor
  
  const discountedTotalUSD = +(totalUSD * ruletaFactor * finalCuponFactor).toFixed(2)
  const discountedTotalBs  = Math.round(totalBs * ruletaFactor * finalCuponFactor)

  const isGratis = discountedTotalUSD <= 0 && totalUSD > 0

  const hasEnoughBalance = walletSaldo >= discountedTotalUSD
  const hasAnySaldo = walletSaldo > 0
  const hasEnoughBalanceBs = walletSaldoBs >= discountedTotalBs
  const hasAnySaldoBs = walletSaldoBs > 0

  const walletAmountToUse = useWalletPartial ? Math.min(walletSaldo, discountedTotalUSD) : 0
  const remainingUSD = discountedTotalUSD - walletAmountToUse
  const tasaDolar = Number(config?.tasa_dolar) || 1
  const remainingBs = (useWalletPartial && walletAmountToUse > 0)
    ? Math.max(0, discountedTotalBs - Math.round(walletAmountToUse * tasaDolar))
    : discountedTotalBs

  const walletBsAmountToUse = useWalletBs ? Math.min(walletSaldoBs, discountedTotalBs) : 0
  const remainingBsFromWallet = Math.round(discountedTotalBs - walletBsAmountToUse)

  const isWalletOnly = selectedMetodoId === 'wallet'
  const isWalletBsOnly = selectedMetodoId === 'wallet_bs'

  const selectedMetodo = useMemo(() => {
    if (isWalletOnly) return { id: 'wallet', nombre: 'Billetera USD', icono: '💼', datos: 'Pago instantáneo con tu saldo USD disponible.' }
    if (isWalletBsOnly) return { id: 'wallet_bs', nombre: 'Billetera Bs', icono: '🏦', datos: 'Pago instantáneo con tu saldo Bs disponible.' }
    return metodosDisponibles.find(m => m.id === selectedMetodoId)
  }, [metodosDisponibles, selectedMetodoId, isWalletOnly, isWalletBsOnly])

  const isBinanceSelected = useMemo(() => {
    const nombre = selectedMetodo?.nombre?.toLowerCase().trim();
    return nombre === 'binance pay automático' || nombre?.includes('binance');
  }, [selectedMetodo]);

  const handleToggleWalletPartial = () => {
    if (!hasAnySaldo) return
    const newVal = !useWalletPartial
    setUseWalletPartial(newVal)
    if (newVal) setUseWalletBs(false)
    if (newVal && hasEnoughBalance) setSelectedMetodoId('wallet')
    else if (!newVal && selectedMetodoId === 'wallet') setSelectedMetodoId('')
  }

  const handleToggleWalletBs = () => {
    if (!hasAnySaldoBs) return
    const newVal = !useWalletBs
    setUseWalletBs(newVal)
    if (newVal) setUseWalletPartial(false)
    if (newVal && hasEnoughBalanceBs) setSelectedMetodoId('wallet_bs')
    else if (!newVal && selectedMetodoId === 'wallet_bs') setSelectedMetodoId('')
  }

  const handleSelectMetodo = (id) => {
    if (id !== 'wallet') {
      setSelectedMetodoId(id)
      setTimeout(() => {
        const mainElement = document.querySelector('.main-content');
        if (mainElement) mainElement.scrollTo({ top: 300, behavior: 'smooth' });
      }, 100);
    } else {
      if (hasEnoughBalance) {
        setSelectedMetodoId('wallet')
        setUseWalletPartial(true)
      }
    }
  }

  const handleToggleRuletaDesc = () => {
    if (ruletaDescuentos.length === 0) return
    const newVal = !useRuletaDesc
    setUseRuletaDesc(newVal)
    if (newVal && ruletaDescuentos.length > 0 && !selectedRuletaDesc) {
      setSelectedRuletaDesc(ruletaDescuentos[0])
    }
  }

  const handleApplyCupon = async () => {
    if (!cuponInput.trim()) return
    setValidatingCupon(true)
    const { data, error } = await supabase.rpc('validar_cupon_rpc', {
      p_codigo: cuponInput.trim().toUpperCase(),
      p_usuario_id: user?.id || perfil?.id || perfil?.cliente_uuid
    })
    setValidatingCupon(false)

    if (error) {
      setAlertModal({ type: 'error', message: 'Error al validar el cupón: ' + error.message })
    } else if (data && !data.valido) {
      setAlertModal({ type: 'warning', message: data.mensaje })
      setActiveCupon(null)
    } else if (data && data.valido) {
      setActiveCupon(data)
      setAlertModal({ type: 'success', message: `¡Cupón aplicado! Se ha aplicado un ${data.porcentaje_descuento}% de descuento.` })
    }
  }

  const handleRemoveCupon = () => {
    setActiveCupon(null)
    setCuponInput('')
  }

  const handleOrderExpired = useCallback(async () => {
    try {
      await cancelarPedidosExpirados()
      alert("⏱️ El tiempo para reportar este pedido ha expirado. El pedido fue cancelado automáticamente.")
      setCreatedPedidoId(null)
      setExpiresAt(null)
      setCurrentStep(1)
      setReferencia('')
      orderPreparingRef.current = false
    } catch (err) {
      console.error("Error al manejar expiración:", err)
    }
  }, [cancelarPedidosExpirados])

  const handleComprobanteUpload = async (e) => {
    let file = e.target.files[0]
    if (!file) return
    setUploadingComprobante(true)
    try {
      file = await compressImage(file)
      const fileName = `pedidos/${Date.now()}_${createdPedidoId || 'tmp'}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { cacheControl: '31536000', upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
      setComprobanteUrl(publicUrl)
    } catch (err) {
      alert('Error al subir el comprobante: ' + err.message)
    } finally {
      setUploadingComprobante(false)
    }
  }

  const handleFinalizar = async () => {
    const isBinancePay = selectedMetodo?.nombre?.toLowerCase().trim() === 'binance pay automático';
    
    if (!isWalletOnly && !isWalletBsOnly && !isBinancePay && !isGratis) {
      if (!referencia.trim()) {
        setAlertModal({ type: 'warning', message: 'Por favor ingresa el número de referencia de tu pago.' })
        return
      }
      if (referencia.trim().length !== 6) {
        setAlertModal({ type: 'warning', message: 'La referencia debe contener exactamente los últimos 6 dígitos del comprobante.' })
        return
      }
    }

    const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id;
    if (!targetUserId) {
      setAlertModal({ type: 'error', message: 'No se pudo identificar tu usuario. Por favor intenta recargar la página.' })
      return
    }

    // Capturar montos exactos ANTES de que el checkout limpie el carrito
    const amountUSDToDeduct = walletAmountToUse;
    const amountBsToDeduct = walletBsAmountToUse;
    const currentIsWalletOnly = isWalletOnly;
    const currentIsWalletBsOnly = isWalletBsOnly;
    const currentRemainingUSD = remainingUSD;

    setIsProcessing(true)
    try {
      // 1. Validar referencia duplicada (Si no es pago con billetera o gratis o binance)
      if (!currentIsWalletOnly && !currentIsWalletBsOnly && !isGratis && !isBinancePay) {
        try {
          await verificarYRegistrarReferencia(referencia, remainingBs || remainingBsFromWallet, 'pedido')
        } catch (err) {
          if (err.message === 'Referencia Duplicada') {
            setAlertModal({ 
              type: 'error', 
              title: 'Referencia Duplicada', 
              message: 'Esta referencia ya ha sido utilizada en otros pedidos, si intentas registrar referencias duplicadas para usar el mismo pago para dos pedidos diferentes podrías ser suspendido del sistema.\n\nSi crees que ha ocurrido un error, comunícate con soporte' 
            })
            setIsProcessing(false)
            return
          }
          if (err.message === 'Referencia Rechazada') {
            setAlertModal({ 
              type: 'error', 
              title: 'Referencia Inválida', 
              message: 'Esta referencia fue RECHAZADA anteriormente por administración por ser inexistente o inválida.\n\nIntentar registrar pagos falsos repetidamente resultará en el baneo de tu cuenta.' 
            })
            setIsProcessing(false)
            return
          }
          throw err
        }
      }
      let finalMetodoId = selectedMetodoId
      let finalReferencia = referencia

      // SI ES PAGO TOTAL CON BILLETERA, GENERAR REFERENCIA AUTOMÁTICA
      if (currentIsWalletOnly) {
        finalReferencia = 'PAGO_BILLETERA_USD_TOTAL'
      } else if (currentIsWalletBsOnly) {
        finalReferencia = 'PAGO_BILLETERA_BS_TOTAL'
      }

      // 1. Procesar débitos de billetera ANTES de crear el pedido para garantizar el pago
      if ((useWalletPartial || currentIsWalletOnly) && amountUSDToDeduct > 0) {
        if (currentIsWalletOnly) finalMetodoId = null; // EVITAR ERROR UUID
        try {
          const { data: walletRes, error: walletError } = await supabase.rpc('pagar_con_billetera_rpc', {
            p_user_id: targetUserId,
            p_amount: amountUSDToDeduct,
            p_pedido_id: null, 
            p_description: `Reserva para pedido en proceso - USD`
          })

          if (walletError || walletRes === false || walletRes?.success === false) {
            alert(`ERROR COBRO USD: ${walletError?.message || walletRes?.message || 'Fondos insuficientes'}`);
            setIsProcessing(false);
            return;
          }
        } catch (e) {
          alert("CRASH COBRO USD: " + e.message);
          setIsProcessing(false);
          return;
        }
      }

      if ((useWalletBs || currentIsWalletBsOnly) && amountBsToDeduct > 0) {
        if (currentIsWalletBsOnly) finalMetodoId = null; // EVITAR ERROR UUID
        try {
          const { data: walletBsRes, error: walletErrorBs } = await supabase.rpc('pagar_con_billetera_bs_rpc', {
            p_user_id: targetUserId,
            p_amount: amountBsToDeduct,
            p_pedido_id: null,
            p_description: `Pago Billetera Bs - Monto: ${amountBsToDeduct}`
          })

          if (walletErrorBs || walletBsRes === false || walletBsRes?.success === false) {
            alert(`ERROR COBRO BS: ${walletErrorBs?.message || walletBsRes?.message || 'Fondos insuficientes'}`);
            setIsProcessing(false);
            return;
          }
        } catch (e) {
          alert("CRASH COBRO BS: " + e.message);
          setIsProcessing(false);
          return;
        }
      }

      // Añadir info de pago fraccionado a la referencia
      if (!currentIsWalletOnly && !currentIsWalletBsOnly) {
        let walletInfo = [];
        if (useWalletPartial && amountUSDToDeduct > 0) {
          walletInfo.push(`Billetera USD: $${amountUSDToDeduct.toFixed(2)}`);
        }
        if (useWalletBs && amountBsToDeduct > 0) {
          walletInfo.push(`Billetera Bs: ${amountBsToDeduct}`);
        }
        if (walletInfo.length > 0) {
          finalReferencia = finalReferencia ? `${finalReferencia} | Pago Parcial: ${walletInfo.join(' y ')}` : `Pago Parcial: ${walletInfo.join(' y ')}`;
        }
      }

      if (isBinancePay) {
        finalReferencia = 'PENDIENTE_BINANCE_PAY';
      }

      const results = await checkout(registrarVenta, user?.id || perfil?.id, finalMetodoId, finalReferencia, null, activeRuletaDesc, createdPedidoId, comprobanteUrl, true, activeCupon)
      
      const pedidoResult = results.find(r => r.id === 'pedido')
      
      if (!pedidoResult || pedidoResult.error) {
        // SI EL PEDIDO FALLÓ PERO YA COBRAMOS (Caso raro), DEBERÍAMOS DEVOLVER EL DINERO
        // Por ahora, lanzamos el error
        throw new Error(pedidoResult?.error || 'No se pudo crear el pedido');
      }

      const pedidoId = pedidoResult.data.id;
      
      if (!targetUserId) throw new Error('No se pudo identificar al usuario para la transacción.');

      if (isBinancePay) {
        // Llamar a la Serverless Function de Binance Pay
        try {
          const res = await fetch('/api/binance/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedidoId: pedidoId, amount: currentRemainingUSD > 0 ? currentRemainingUSD : totalUSD })
          });
          const data = await res.json();
          
          if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
            return; // Redirige y no ejecuta más código
          } else {
            throw new Error(data.error || 'Desconocido');
          }
        } catch (error) {
          // Si falla Binance, eliminamos el pedido recién creado para no dejar basura pendiente
          await supabase.from('pedido_items').delete().eq('pedido_id', pedidoId);
          await supabase.from('pedidos').delete().eq('id', pedidoId);
          throw new Error('Error al conectar con Binance Pay: Verifica que tus API Keys tengan permisos de "Merchant" y sean correctas. Detalle: ' + error.message);
        }
      }

      if (activeRuletaDesc) {
        await supabase.from('ruleta_descuentos_pendientes').update({ usado: true, pedido_id: pedidoId }).eq('id', activeRuletaDesc.id)
      }

      if (creadorDescuento) {
        await supabase.rpc('registrar_uso_codigo_creador', {
          p_codigo_id: creadorDescuento.id,
          p_usuario_id: targetUserId
        });
      }

      // Actualizar el perfil para reflejar el nuevo saldo de la billetera
      refreshPerfil();
      
      // Reproducir sonido de caja (original)
      playCashRegisterSound()
      
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('¡Pedido Registrado!', {
            body: `Tu pedido ha sido creado exitosamente y está siendo verificado.`,
          });
        } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      } catch (notifErr) {
        console.log('Error con notificaciones push:', notifErr);
      }

      setIsAutomaticResult(isGratis || currentIsWalletOnly || currentIsWalletBsOnly)
      setCreatedPedidoData(pedidoResult.data)
      setOrderFinished(true)
    } catch (err) {
      console.error("Finalizar error:", err);
      
      // Liberar la referencia si se había registrado pero el proceso falló
      if (!currentIsWalletOnly && !currentIsWalletBsOnly && !isGratis && !isBinancePay && referencia.trim()) {
        try {
          await supabase.rpc('liberar_referencia_rpc', { p_referencia: referencia });
        } catch (releaseErr) {
          console.error("Error al liberar referencia:", releaseErr);
        }
      }

      setAlertModal({ type: 'error', message: 'Error: ' + err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  if (orderFinished) {
    const successInner = (
      <div className="landing-container" style={{ paddingTop: embedded ? '24px' : '100px', paddingBottom: '60px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div className="card" style={{ textAlign: 'center', padding: '32px', maxWidth: '500px', width: '100%', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}>
            {!showTracking ? (
              <div className="fade-in">
                <div style={{ marginBottom: '24px' }}>
                  <img src="/assets/Verificando.PNG.png" alt="Verificación" style={{ width: '120px' }} />
                </div>
                <h2 style={{ color: 'var(--accent-success)', fontWeight: 800 }}>¡Pedido Creado!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', whiteSpace: 'pre-line', fontSize: '15px' }}>
                  {isAutomaticResult ? (
                    <>
                      Tu pedido se ha registrado exitosamente y está en proceso.{"\n\n"}
                      Dicho proceso comprende entre 5 a 20 minutos. Puedes consultar el estado en "Mis Pedidos".
                    </>
                  ) : (
                    <>
                      Tu pedido se ha registrado exitosamente. En estos momentos tu pago se está verificando.{"\n\n"}
                      Puedes consultar el estado en "Mis Pedidos" y el tiempo estimado es de 5 a 20 minutos para la respuesta.
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowTracking(true)}
                    style={{ height: '56px', borderRadius: '14px', fontSize: '16px', fontWeight: 800, background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)' }}
                  >
                    👁️ Ver Pedido
                  </button>
                  <button className="btn btn-ghost" onClick={onFinish} style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Volver al Inicio</button>
                </div>
              </div>
            ) : (
              <div className="tracking-view fade-in">
                <OrderTracking pedidoInitial={createdPedidoData} onBack={onFinish} />
              </div>
            )}
          </div>
        </div>
      </div>
    );

    if (embedded) return successInner;

    return (
      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 0, overflowX: 'hidden', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <FloatingBackground />
        <header className="landing-header">
          <div className="landing-container flex items-center justify-between landing-header-inner">
            <div className="flex items-center landing-header-left">
              <div className="landing-logo-container" onClick={onFinish} style={{ cursor: 'pointer' }}>
                {config?.landing_logo ? (
                  <img src={config.landing_logo} alt="Logo" className="landing-logo-img" />
                ) : (
                  <>
                    <div className="landing-logo-icon">⚡</div>
                    <span className="landing-logo-text">{config?.landing_titulo || 'Recargas Hulk'}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
        {successInner}
      </div>
    );
  }

  // embedded=true → la Landing provee el wrapper, header y banner.
  // El checkout renderiza normalmente pero con clase checkout-embedded
  // para que el CSS oculte su propio header/banner.

  return (
    <>
      <div className={embedded ? 'checkout-embedded' : ''} style={{ minHeight: '100vh', position: 'relative', zIndex: 0, overflowX: 'hidden', background: embedded ? 'transparent' : 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {!embedded && <FloatingBackground />}
        
        {/* HEADER — idéntico a Landing */}
        <header className="landing-header">
          <div className="landing-container flex items-center justify-between landing-header-inner">
            <div className="flex items-center landing-header-left">
              <div className="landing-logo-container" onClick={onFinish} style={{ cursor: 'pointer' }}>
                {config?.landing_logo ? (
                  <img src={config.landing_logo} alt="Logo" className="landing-logo-img" />
                ) : (
                  <>
                    <div className="landing-logo-icon">⚡</div>
                    <span className="landing-logo-text">{config?.landing_titulo || 'Recargas Hulk'}</span>
                  </>
                )}
              </div>
              <nav className="landing-nav hidden-mobile" style={{ marginLeft: '24px' }}>
                <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); onFinish(); }}>Home</a>
                <a href="#" className="nav-link active">Checkout</a>
              </nav>
            </div>

            <div className="flex items-center landing-header-right">

              {/* Carrito */}
              {user && (
                <div
                  style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={onFinish}
                  title="Ver Carrito"
                >
                  <span style={{ fontSize: '24px' }}>🛒</span>
                  {cart.length > 0 && (
                    <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                      {cart.length}
                    </div>
                  )}
                </div>
              )}

              {/* Campana notificaciones */}
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
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {notificaciones.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No tienes notificaciones</div>
                      ) : notificaciones.map(noti => (
                        <div
                          key={noti.id}
                          onClick={() => markNotiAsRead(noti.id)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border)',
                            backgroundColor: noti.leido ? 'transparent' : 'rgba(0, 210, 255, 0.05)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {!noti.leido && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></div>}
                            {noti.titulo}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{noti.mensaje}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mi Cuenta */}
              {user && (
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
                    <a href="#" onClick={(e) => { e.preventDefault(); onFinish(); }}>Regresar a la Tienda</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = '/Mis-Pedidos'; }}>Mis Pedidos</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = '/Billetera'; }}>Billetera</a>
                  </div>
                </div>
              )}

            </div>
          </div>
        </header>

      <main className="landing-main">
        {/* BANNER SLIDER — misma estructura exacta que Landing */}
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
                </div>
              </div>
            ))}
            <div className="slider-dots">
              {banners.map((_, idx) => (
                <span
                  key={idx}
                  className={`dot ${idx === currentBanner ? 'active' : ''}`}
                  onClick={() => setCurrentBanner(idx)}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="landing-container" style={{ paddingTop: '40px', paddingBottom: '80px', position: 'relative', zIndex: 10, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="page-header mb-10" style={{ paddingBottom: 0, display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={onFinish}
            title="Regresar"
            style={{ 
              borderRadius: '16px', 
              width: '48px', 
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: 'none',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              flexShrink: 0,
              transition: 'all 0.3s'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            ←
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '32px', fontWeight: 900, background: 'linear-gradient(90deg, #11998e, #38ef7d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>Confirmación de Compra</h1>
            <p className="page-subtitle" style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
              {currentStep === 1 ? 'Revisa tus productos y selecciona tu método de pago.' : 'Completa los datos de tu pago para procesar la orden.'}
            </p>
          </div>
        </div>

      <div className="responsive-grid-2col" style={{ display: 'grid', gap: '24px', alignItems: 'start', maxWidth: '100%' }}>
        <div style={{ backgroundColor: '#10121b', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.03)', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
          {currentStep === 1 ? (
            <>
              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '24px', background: 'linear-gradient(to bottom, #11998e, #38ef7d)', borderRadius: '4px' }}></div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Tus Productos</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cart.map(item => (
                  <div key={item.id} className="checkout-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', transition: 'all 0.3s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}>
                    <div style={{ width: 56, height: 56, borderRadius: '12px', overflow: 'hidden', backgroundColor: '#1a1d2d', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {item.icono_url ? <img src={item.icono_url} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '16px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{item.juego}</div>
                      <div className="checkout-details-box" style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(56, 239, 125, 0.2)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                         {item.metodo_recarga === 'solo_correo' ? `📧 ${item.account_email}`
                          : item.metodo_recarga === 'solo_usuario' ? `👤 ${item.account_user}`
                          : item.metodo_recarga === 'cuenta_completa' ? `📧 ${item.account_email}` 
                          : item.metodo_recarga === 'usuario_clave' ? `👤 ${item.account_user}` 
                          : item.metodo_recarga === 'cuenta_nueva' ? `✨ Cuenta Nueva`
                          : item.metodo_recarga === 'id_zone' ? `🆔 ${item.player_id} (${item.zone_id})` 
                          : item.metodo_recarga === 'entrega_codigo' ? `🎁 Entrega de Código`
                          : item.metodo_recarga === 'sin_datos' ? `📥 Entrega Automática`
                          : `🆔 ${item.player_id}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#fff', fontSize: '18px', fontWeight: 900 }}>{formatBs(item.venta_bs * item.quantity)}</div>
                    </div>
                    {/* Botón quitar del carrito */}
                    <button
                      onClick={() => removeFromCart(item.cart_id)}
                      title="Quitar del carrito"
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        background: '#ef4444',
                        border: '2px solid #10121b',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1,
                        fontWeight: 800,
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
             <div style={{ padding: '40px 24px', textAlign: 'center' }}>
               <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'pulse 2s infinite' }}>⌛</div>
               <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Esperando Confirmación</h3>
               <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>Por favor, completa tu pago mediante {selectedMetodo?.nombre}</p>
               {expiresAt && <CountdownTimer expiryDate={expiresAt} onExpire={handleOrderExpired} />}
             </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '24px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
               onClick={() => currentStep === 1 ? onFinish() : setCurrentStep(1)}
               style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
               onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
               onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            >
              {currentStep === 1 ? 'Cancelar Compra' : '← Modificar Pedido'}
            </button>
          </div>
        </div>

        <div style={{ backgroundColor: '#10121b', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.03)', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '24px', background: 'linear-gradient(to bottom, #f12711, #f5af19)', borderRadius: '4px' }}></div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Pago y Descuentos</h3>
          </div>
          <div>
            {currentStep === 1 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {hasAnySaldo && !isGratis && hasWalletUSD && (
                    <div onClick={handleToggleWalletPartial} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '16px', backgroundColor: useWalletPartial ? 'rgba(56, 239, 125, 0.1)' : 'rgba(255,255,255,0.02)', border: `2px solid ${useWalletPartial ? '#38ef7d' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', transition: 'all 0.2s', opacity: useWalletBs ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>💵</span>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>Usar Saldo USD</span>
                      </div>
                      <span style={{ fontWeight: 800, color: '#38ef7d' }}>{formatBs(Math.round(walletSaldo * (Number(config?.tasa_dolar) || 1)))}</span>
                    </div>
                  )}
                  {hasAnySaldoBs && !isGratis && hasWalletBs && (
                    <div onClick={handleToggleWalletBs} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '16px', backgroundColor: useWalletBs ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.02)', border: `2px solid ${useWalletBs ? '#a855f7' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', transition: 'all 0.2s', opacity: useWalletPartial ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>🏦</span>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>Usar Saldo Bs</span>
                      </div>
                      <span style={{ fontWeight: 800, color: '#a855f7' }}>{formatBs(walletSaldoBs)}</span>
                    </div>
                  )}
                  {!isGratis && config?.ruleta_activa !== '0' && config?.ruleta_activa !== 'false' && (
                    <div onClick={handleToggleRuletaDesc} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderRadius: '16px', backgroundColor: useRuletaDesc ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255,255,255,0.02)', border: `2px solid ${useRuletaDesc ? '#FFD700' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', transition: 'all 0.2s', opacity: ruletaDescuentos.length === 0 ? 0.5 : 1 }}>
                      <span style={{ fontSize: '24px', marginRight: '12px' }}>🎡</span>
                      <span style={{ fontWeight: 700, fontSize: '15px' }}>Aplicar Descuento de Ruleta</span>
                    </div>
                  )}
                </div>

                {useRuletaDesc && ruletaDescuentos.length > 0 && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                     {ruletaDescuentos.map(d => (
                       <div key={d.id} onClick={() => setSelectedRuletaDesc(d)} style={{ padding: '10px', borderRadius: '8px', border: `2px solid ${selectedRuletaDesc?.id === d.id ? '#FFD700' : 'var(--border-color)'}`, cursor: 'pointer' }}>
                         {d.nombre} (-{d.porcentaje}%)
                       </div>
                     ))}
                  </div>
                )}

                {!isGratis && (
                  <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    {creadorDescuento ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(56, 239, 125, 0.1)', border: '1px solid rgba(56, 239, 125, 0.3)' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#38ef7d', fontSize: '14px', textTransform: 'uppercase' }}>🌟 Código de Creador Aplicado</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{creadorDescuento.codigo} (-{creadorDescuento.porcentaje_descuento}%)</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎟️ Código Promocional</div>
                        {!activeCupon ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={cuponInput}
                          onChange={(e) => setCuponInput(e.target.value.replace(/\s+/g, '').toUpperCase())}
                          placeholder="Ingresa tu cupón"
                          style={{ flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', boxSizing: 'border-box' }}
                        />
                        <button
                          onClick={handleApplyCupon}
                          disabled={validatingCupon || !cuponInput.trim()}
                          style={{ padding: '0 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontWeight: 700, cursor: validatingCupon || !cuponInput.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { if(!validatingCupon && cuponInput.trim()) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        >
                          {validatingCupon ? '...' : 'Aplicar'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(56, 239, 125, 0.1)', border: '1px solid rgba(56, 239, 125, 0.3)' }}>
                        <div>
                          <span style={{ fontWeight: 900, color: '#38ef7d', fontSize: '16px' }}>{activeCupon.codigo}</span>
                          <span style={{ fontSize: '13px', marginLeft: '8px', color: '#fff', fontWeight: 700, backgroundColor: 'rgba(56, 239, 125, 0.2)', padding: '2px 8px', borderRadius: '12px' }}>-{activeCupon.porcentaje_descuento}% OFF</span>
                        </div>
                        <button onClick={handleRemoveCupon} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 800 }}>✕</button>
                      </div>
                    )}
                      </>
                    )}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginBottom: '12px' }}>
                  {isGratis ? (
                    <>
                      <div style={{ padding: '32px 24px', textAlign: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '24px', color: 'var(--accent-success)', border: '2px dashed var(--accent-success)', marginBottom: '16px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                        <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>¡Pedido Gratuito!</h3>
                        <p style={{ fontSize: '14px', opacity: 0.8 }}>Tu cupón cubre el 100% del total.</p>
                      </div>
                      <button
                        className="btn btn-primary btn-lg"
                        style={{
                          width: '100%', height: '52px', fontSize: '17px', fontWeight: 800,
                          borderRadius: '18px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)',
                          boxShadow: '0 8px 24px rgba(0, 180, 255, 0.4)', border: 'none', color: 'white',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: isProcessing ? 'default' : 'pointer'
                        }}
                        disabled={isProcessing}
                        onClick={handleFinalizar}
                        onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => !isProcessing && (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        {isProcessing ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <div className="spinner-border spinner-border-sm" role="status" />
                            <span>PROCESANDO...</span>
                          </div>
                        ) : 'Confirmar y Pagar'}
                      </button>
                    </>
                  ) : ((!useWalletPartial && !useWalletBs) || (!hasEnoughBalance && useWalletPartial) || (!hasEnoughBalanceBs && useWalletBs)) ? (
                    <>
                      {selectedMetodoId && !isWalletOnly && !isWalletBsOnly ? (
                        <div className="selected-method-details fade-in">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: 56, height: 56, borderRadius: '14px', backgroundColor: '#fff', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
                                <img src={selectedMetodo?.icono_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>{selectedMetodo?.nombre}</span>
                                <span style={{ fontSize: '11px', color: '#38ef7d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Datos para reportar:</span>
                              </div>
                            </div>
                            <button 
                              className="btn btn-ghost btn-sm" 
                              onClick={() => setSelectedMetodoId('')}
                              style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                            >
                              ✕ Cambiar
                            </button>
                          </div>

                          {/* ── RESUMEN DE TOTALES ── */}
                          <div style={{
                            backgroundColor: 'rgba(168, 85, 247, 0.05)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '16px',
                            padding: '20px',
                            marginBottom: '24px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Monto del Pedido:</span>
                              <span style={{ fontWeight: 800, color: '#fff' }}>{isBinanceSelected ? formatUSD(discountedTotalUSD) : formatBs(discountedTotalBs)}</span>
                            </div>
                            {((isBinanceSelected && useWalletPartial) || (!isBinanceSelected && useWalletBs)) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#a855f7' }}>
                                <span style={{ fontWeight: 700 }}>🏦 Saldo Billetera:</span>
                                <span style={{ fontWeight: 900 }}>-{isBinanceSelected ? formatUSD(Math.min(walletSaldo, discountedTotalUSD)) : formatBs(Math.min(walletSaldoBs, discountedTotalBs))}</span>
                              </div>
                            )}
                            <div style={{ borderTop: '1px dashed rgba(168, 85, 247, 0.3)', marginTop: '12px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 900, fontSize: '16px', color: '#fff' }}>Resta por Pagar:</span>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#a855f7', fontSize: '24px', fontWeight: 900, textShadow: '0 2px 10px rgba(168, 85, 247, 0.3)' }}>
                                  {isBinanceSelected 
                                    ? formatUSD(Math.max(0, discountedTotalUSD - (useWalletPartial ? walletSaldo : 0)))
                                    : formatBs(Math.max(0, discountedTotalBs - (useWalletBs ? walletSaldoBs : 0)))
                                  }
                                </div>
                              </div>
                            </div>
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '12px', textAlign: 'center', fontWeight: 600 }}>
                              Selecciona un método abajo para pagar la diferencia.
                            </p>
                          </div>

                          {selectedMetodo?.datos && (
                            <button 
                              className="btn btn-ghost btn-sm"
                              style={{ width: '100%', marginBottom: '24px', border: '1px dashed rgba(0, 210, 255, 0.4)', borderRadius: '14px', color: '#00d2ff', fontWeight: 800, padding: '14px', backgroundColor: 'rgba(0, 210, 255, 0.05)', transition: 'all 0.2s' }}
                              onClick={(e) => {
                                navigator.clipboard.writeText(selectedMetodo.datos);
                                const btn = e.currentTarget;
                                btn.innerText = '✅ ¡Datos de Pago Copiados!';
                                btn.style.backgroundColor = 'rgba(56, 239, 125, 0.1)';
                                btn.style.color = '#38ef7d';
                                btn.style.borderColor = '#38ef7d';
                                setTimeout(() => { 
                                  btn.innerText = '📋 Copiar Todos los Datos'; 
                                  btn.style.backgroundColor = 'rgba(0, 210, 255, 0.05)';
                                  btn.style.color = '#00d2ff';
                                  btn.style.borderColor = 'rgba(0, 210, 255, 0.4)';
                                }, 2000);
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.1)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.05)'; }}
                            >
                              📋 Copiar Todos los Datos
                            </button>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            {selectedMetodo?.datos && typeof selectedMetodo.datos === 'string' && selectedMetodo.datos.split('\n').filter(l => l.trim()).map((line, i) => {
                              const [label, ...valParts] = line.split(':');
                              const value = valParts.join(':').trim();
                              
                              return (
                                <div key={i} style={{ 
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                  padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', 
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  gap: '12px', transition: 'all 0.3s'
                                }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}>
                                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                    {label && value ? (
                                      <>
                                        <span style={{ fontSize: '11px', color: '#00d2ff', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '1px', marginBottom: '4px' }}>{label.trim()}</span>
                                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>{value}</span>
                                      </>
                                    ) : (
                                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>{line}</span>
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(value || line);
                                    }} 
                                    style={{ 
                                      padding: '12px', borderRadius: '12px', background: 'rgba(0, 210, 255, 0.1)', 
                                      border: 'none', color: '#00d2ff', 
                                      cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '16px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 210, 255, 0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 210, 255, 0.1)'}
                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  >📋</button>
                                </div>
                              );
                            })}
                          </div>

                          {selectedMetodo?.qr_url && (
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                              <div style={{ 
                                display: 'inline-block', padding: '16px', backgroundColor: 'white', 
                                borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', marginBottom: '12px',
                                border: '4px solid var(--bg-panel)'
                              }}>
                                <img src={selectedMetodo.qr_url} alt="QR" style={{ width: '160px', height: '160px', objectFit: 'contain' }} />
                              </div>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Escanea para pagar</p>
                            </div>
                          )}

                          {selectedMetodoId !== 'binance_pay_auto' && (
                            <div className="form-group mb-16">
                              <label className="form-label" style={{ color: '#00d2ff', fontWeight: 900, fontSize: '13px', marginBottom: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Número de Referencia <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: 600 }}>(Últimos 6 dígitos)</span>
                              </label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Escribe los 6 últimos dígitos aquí..."
                                value={referencia} 
                                onChange={e => {
                                  // Detener en 6 dígitos y no desplazar
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                  setReferencia(val);
                                }}
                                onPaste={e => {
                                  e.preventDefault();
                                  const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
                                  setReferencia(pasteData);
                                }}
                                style={{ 
                                  border: '2px solid rgba(0, 210, 255, 0.3)', 
                                  backgroundColor: 'rgba(0,0,0,0.2)',
                                  color: '#fff',
                                  borderRadius: '16px', 
                                  height: '56px', 
                                  padding: '0 20px', 
                                  letterSpacing: '3px', 
                                  fontSize: '18px', 
                                  fontWeight: 800,
                                  outline: 'none',
                                  transition: 'all 0.3s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#00d2ff'}
                                onBlur={e => e.target.style.borderColor = 'rgba(0, 210, 255, 0.3)'}
                              />
                              <div style={{ fontSize: '12px', color: '#f5af19', marginTop: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⚠️ Recuerda que debes colocar exactamente los 6 últimos números de la referencia.
                              </div>
                            </div>
                          )}

                          {/* ── BOTÓN CONFIRMAR justo bajo la referencia ── */}
                          <button
                            className="btn btn-primary btn-lg"
                            style={{
                              width: '100%', marginBottom: '24px', height: '60px', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px',
                              borderRadius: '16px', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                              boxShadow: '0 10px 30px rgba(56, 239, 125, 0.4)', border: 'none', color: '#000',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: isProcessing ? 'default' : 'pointer'
                            }}
                            disabled={isProcessing || (!isGratis && !isWalletOnly && !isWalletBsOnly && selectedMetodoId !== 'binance_pay_auto' && selectedMetodoId && (referencia.trim().length !== 6))}
                            onClick={handleFinalizar}
                            onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.transform = 'translateY(-3px)')}
                            onMouseLeave={(e) => !isProcessing && (e.currentTarget.style.transform = 'translateY(0)')}
                          >
                            {isProcessing ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                <div className="spinner-border spinner-border-sm" role="status" style={{ color: '#000' }} />
                                <span>PROCESANDO...</span>
                              </div>
                            ) : 'Confirmar y Pagar'}
                          </button>

                          <div className="form-group mb-0">
                            <label className="form-label" style={{ fontSize: '13px', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'block' }}>Adjuntar Comprobante (Opcional)</label>
                            <div style={{ 
                              padding: '24px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '16px', 
                              textAlign: 'center', position: 'relative', backgroundColor: 'rgba(255,255,255,0.02)',
                              transition: 'all 0.3s', cursor: 'pointer'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                            >
                              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{uploadingComprobante ? '⏳' : comprobanteUrl ? '✅' : '📤'}</div>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{uploadingComprobante ? 'Subiendo...' : comprobanteUrl ? 'Comprobante Listo' : 'Toca para subir captura'}</span>
                              <input type="file" accept="image/*" onChange={handleComprobanteUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="payment-methods-grid">
                          <label className="form-label" style={{ gridColumn: '1 / -1', marginBottom: '4px', textAlign: 'center', fontSize: '13px', fontWeight: 700 }}>Selecciona un Método de Pago</label>
                          {metodosDisponibles.map(m => (
                            <button key={m.id} onClick={() => handleSelectMetodo(m.id)} className={`payment-method-btn ${selectedMetodoId === m.id ? 'active' : ''}`} style={{ borderRadius: '16px', padding: '8px 4px' }}>
                              <div style={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <img src={m.icono_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 700, display: 'block' }}>{m.nombre}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ padding: '24px', backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: '20px', border: '1px solid var(--accent-success)', color: 'var(--accent-success)', textAlign: 'center', marginBottom: '16px' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                        <span style={{ fontWeight: 800, fontSize: '16px' }}>Pago Cubierto</span>
                        <p style={{ fontSize: '12px', marginTop: '4px' }}>El monto se descontará de tu billetera.</p>
                      </div>
                      {/* Total compacto para billetera */}
                      <div style={{ backgroundColor: 'rgba(0, 245, 212, 0.06)', border: '1px solid var(--accent-success)', borderRadius: '16px', padding: '14px 16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '15px' }}>Total Pagar:</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--accent-success)', fontSize: '22px', fontWeight: 900 }}>
                              {useWalletBs && !hasEnoughBalanceBs ? formatBs(remainingBsFromWallet) : formatBs(remainingBs)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-lg"
                        style={{
                          width: '100%', height: '52px', fontSize: '17px', fontWeight: 800,
                          borderRadius: '18px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)',
                          boxShadow: '0 8px 24px rgba(0, 180, 255, 0.4)', border: 'none', color: 'white',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: isProcessing ? 'default' : 'pointer'
                        }}
                        disabled={isProcessing}
                        onClick={handleFinalizar}
                        onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => !isProcessing && (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        {isProcessing ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <div className="spinner-border spinner-border-sm" role="status" />
                            <span>PROCESANDO...</span>
                          </div>
                        ) : 'Confirmar y Pagar'}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 2s infinite' }}>⌛</div>
                <h3 style={{ fontWeight: 800, marginBottom: '8px' }}>Procesando Pedido...</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Esperando confirmación del sistema.</p>
              </div>
            )}
          </div>


          </div>
        </div>
      </div>

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={alertModal.onConfirm || (() => setAlertModal(null))}
          onCancel={alertModal.onCancel || (() => setAlertModal(null))}
        />
      )}
      </main>
    </div>
  </>
  )
}




// ============================================================
// OrderTracking - Componente para seguimiento en tiempo real
// ============================================================
function OrderTracking({ pedidoInitial, onBack }) {
  const [pedido, setPedido] = useState(pedidoInitial)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)

  useEffect(() => {
    if (!pedido?.id) return

    // 1. Función para obtener los datos actualizados
    const refreshData = async () => {
      // Actualizar Pedido
      const { data: pedidoData } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedido.id)
        .single()
      
      if (pedidoData) setPedido(pedidoData)

      // Actualizar Items
      const { data: itemsData } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', pedido.id)
      
      if (itemsData) setItems(itemsData)
      setLoadingItems(false)
    }

    refreshData()

    // 2. Capa Real-time (Intento de actualización instantánea)
    const pedidoChannel = supabase
      .channel(`tracking_order_${pedido.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedido.id}` }, 
        (payload) => setPedido(prev => ({ ...prev, ...payload.new })))
      .subscribe()

    const itemsChannel = supabase
      .channel(`tracking_items_${pedido.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_items', filter: `pedido_id=eq.${pedido.id}` }, 
        () => refreshData())
      .subscribe()

    // 3. Capa de Seguridad (Polling cada 3 segundos)
    // Esto garantiza la actualización sin recargar la página
    const interval = setInterval(refreshData, 3000)

    return () => {
      supabase.removeChannel(pedidoChannel)
      supabase.removeChannel(itemsChannel)
      clearInterval(interval)
    }
  }, [pedido?.id])

  const getStatusDisplay = (estado) => {
    switch (estado) {
      case 'completado': return { label: 'Completado', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' }
      case 'procesando': return { label: 'En Proceso', icon: '⚡', color: 'var(--accent-primary)', bg: 'rgba(0, 210, 255, 0.1)' }
      case 'fallido': return { label: 'Fallido', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
      case 'reembolsado': return { label: 'Reembolsado', icon: '🔄', color: '#e040fb', bg: 'rgba(224, 64, 251, 0.1)' }
      case 'cancelado': return { label: 'Cancelado', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
      default: return { label: 'Recibido', icon: '⏳', color: '#ffab00', bg: 'rgba(255, 171, 0, 0.1)' }
    }
  }

  const getItemStatusIcon = (estado) => {
    switch (estado) {
      case 'completado': return '✅';
      case 'fallido': return '❌';
      case 'procesando': return '⚡';
      default: return '⏳';
    }
  }

  const status = getStatusDisplay(pedido.estado)

  return (
    <div className="order-tracking fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '4px', fontSize: '20px', fontWeight: 800 }}>Resumen del Pedido</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>#{String(pedido.numero_pedido).padStart(6, '0')}</p>
      </div>

      <div style={{ 
        padding: '24px', borderRadius: '24px', 
        backgroundColor: status.bg, 
        border: `1px solid ${status.color}33`,
        marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '20px',
        justifyContent: 'center',
        boxShadow: `0 8px 24px ${status.color}11`
      }}>
        <span style={{ fontSize: '40px' }}>{status.icon}</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Estatus Actual</div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: status.color }}>{status.label}</div>
        </div>
      </div>

      {pedido.observaciones && (
        <div style={{ 
          padding: '16px', borderRadius: '16px', 
          backgroundColor: 'rgba(245, 158, 11, 0.08)', 
          border: '1px solid rgba(245, 158, 11, 0.3)',
          marginBottom: '24px', textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>📝</span>
            <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nota de Administración:</span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: '1.4' }}>{pedido.observaciones}</p>
        </div>
      )}

      {/* Lista de Paquetes Detallada */}
      <div style={{ textAlign: 'left', marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Paquetes en tu orden:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loadingItems ? (
             <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px' }}>Cargando detalles...</div>
          ) : items.map((item, idx) => (
            <div key={idx} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '12px 16px', borderRadius: '16px', 
              backgroundColor: 'rgba(255,255,255,0.02)', 
              border: item.estado === 'completado' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px' }}>{getItemStatusIcon(item.estado)}</span>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>{item.producto_nombre}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ID: {item.player_id || item.account_email || 'N/A'}</div>
                  {item.referencia_admin && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                      📌 Ref: {item.referencia_admin}
                    </div>
                  )}
                  {item.codigo_entregado && (
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '8px', 
                      backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                      border: '1px dashed #22c55e', 
                      borderRadius: '8px',
                      color: '#22c55e',
                      fontSize: '13px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(item.codigo_entregado);
                      alert('¡Código copiado al portapapeles!');
                    }}>
                      🎁 Código: {item.codigo_entregado} 📋
                    </div>
                  )}
                </div>
              </div>
              <div style={{ color: item.estado === 'completado' ? '#22c55e' : 'var(--text-muted)', fontSize: '12px', fontWeight: 800 }}>
                {item.estado === 'completado' ? 'RECARGADO' : item.estado?.toUpperCase() || 'PENDIENTE'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ 
        textAlign: 'left', marginBottom: '32px', padding: '16px', 
        borderRadius: '20px', backgroundColor: 'rgba(0, 210, 255, 0.05)',
        border: '1px solid var(--accent-primary)33'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 600, fontSize: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Monto Total:</span>
          <span style={{ color: 'var(--accent-primary)', fontSize: '20px', fontWeight: 900 }}>{formatBs(pedido.total_bs)}</span>
        </div>
      </div>

      <button className="btn btn-primary" onClick={onBack} style={{ width: '100%', height: '56px', borderRadius: '16px', fontSize: '16px', fontWeight: 800, background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)' }}>
        Cerrar Seguimiento
      </button>
    </div>
  )
}
