import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useCart, useVentas, useMetodosPago, useAuth, useWallet } from '../hooks/useData'
import { formatUSD, formatBs, playCashRegisterSound } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import { useConfiguracion } from '../hooks/useData'

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

export default function Checkout({ onFinish }) {
  const { cart, removeFromCart, clearCart, checkout, totalUSD, totalBs } = useCart()
  const { registrarVenta, verificarYRegistrarReferencia } = useVentas()
  const { metodos, cancelarPedidosExpirados, loading: loadingMetodos } = useMetodosPago()
  const { perfil, user, isCliente } = useAuth()
  const { wallet } = useWallet()
  const { config } = useConfiguracion()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedMetodoId, setSelectedMetodoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [useWalletPartial, setUseWalletPartial] = useState(false) // Toggle para usar saldo USD
  const [useWalletBs, setUseWalletBs] = useState(false) // Toggle para usar saldo Bs
  const [useRuletaDesc, setUseRuletaDesc] = useState(false) // Toggle para usar descuento de ruleta
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderFinished, setOrderFinished] = useState(false)
  const [createdPedidoId, setCreatedPedidoId] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const orderPreparingRef = React.useRef(false)
  const [comprobanteUrl, setComprobanteUrl] = useState(null)
  const [uploadingComprobante, setUploadingComprobante] = useState(false)
  const [isAutomaticResult, setIsAutomaticResult] = useState(false)
  const [createdPedidoData, setCreatedPedidoData] = useState(null)
  const [showTracking, setShowTracking] = useState(false)

  // Efecto para asegurar que la página siempre aparezca al inicio al cargar o cambiar de paso
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
  
  // Cerramos el checkout si el carrito se queda vacío tras una eliminación (pero no si estamos procesando el pago)
  useEffect(() => {
    if (!orderFinished && !isProcessing && cart.length === 0 && currentStep === 1) {
      onFinish();
    }
  }, [cart, orderFinished, isProcessing, onFinish, currentStep]);

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

  const walletSaldo = wallet?.saldo || 0
  const walletSaldoBs = wallet?.saldo_bs || 0

  const activeRuletaDesc = useRuletaDesc ? selectedRuletaDesc : null
  const ruletaFactor = activeRuletaDesc ? (1 - activeRuletaDesc.porcentaje / 100) : 1
  const discountedTotalUSD = +(totalUSD * ruletaFactor).toFixed(2)
  const discountedTotalBs  = Math.round(totalBs * ruletaFactor)

  const isGratis = discountedTotalUSD <= 0

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
    if (isWalletOnly) return { nombre: 'Billetera USD', icono: '💼', datos: 'Pago instantáneo con tu saldo USD disponible.' }
    if (isWalletBsOnly) return { nombre: 'Billetera Bs', icono: '🏦', datos: 'Pago instantáneo con tu saldo Bs disponible.' }
    return metodos.find(m => m.id === selectedMetodoId)
  }, [metodos, selectedMetodoId, isWalletOnly, isWalletBsOnly])

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
    const file = e.target.files[0]
    if (!file) return
    setUploadingComprobante(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `pedidos/${Date.now()}_${createdPedidoId || 'tmp'}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true })
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
    if (!isWalletOnly && !isWalletBsOnly && !referencia.trim() && !isGratis) {
      alert('Por favor ingresa el número de referencia de tu pago.')
      return
    }

    setIsProcessing(true)
    try {
      // 1. Validar referencia duplicada (Si no es pago con billetera o gratis)
      if (!isWalletOnly && !isWalletBsOnly && !isGratis) {
        try {
          await verificarYRegistrarReferencia(referencia, remainingBs || remainingBsFromWallet, 'pedido')
        } catch (err) {
          if (err.message === 'Referencia Duplicada') {
            alert('Referencia Duplicada')
            setIsProcessing(false)
            return
          }
          throw err
        }
      }
      let finalMetodoId = selectedMetodoId
      let finalReferencia = referencia

      if (isGratis) {
        finalMetodoId = null
        finalReferencia = 'PAGO_TOTAL'
      } else if (useWalletPartial && walletAmountToUse > 0) {
        if (isWalletOnly) {
          finalMetodoId = null
          finalReferencia = 'PAGO_BILLETERA_USD_TOTAL'
        } else {
          finalReferencia = `${referencia} | Billetera USD: ${formatUSD(walletAmountToUse)}`
        }
      } else if (useWalletBs && walletBsAmountToUse > 0) {
        if (isWalletBsOnly) {
          finalMetodoId = null
          finalReferencia = 'PAGO_BILLETERA_BS_TOTAL'
        } else {
          finalReferencia = `${referencia} | Billetera Bs: ${formatBs(walletBsAmountToUse)}`
        }
      }

      const results = await checkout(registrarVenta, user?.id || perfil?.id, finalMetodoId, finalReferencia, null, activeRuletaDesc, createdPedidoId, comprobanteUrl, true)
      const pedidoResult = results.find(r => r.id === 'pedido')
      
      if (!pedidoResult || pedidoResult.error) throw new Error(pedidoResult?.error || 'No se pudo crear el pedido')

      const pedidoId = pedidoResult.data.id;

      const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id;
      if (!targetUserId) throw new Error('No se pudo identificar al usuario para la transacción.');

      if (useWalletPartial && walletAmountToUse > 0) {
        await supabase.rpc('pagar_con_billetera_rpc', {
          p_user_id: targetUserId,
          p_amount: walletAmountToUse,
          p_pedido_id: pedidoId,
          p_description: isWalletOnly ? `Pago de pedido #${pedidoResult.data.numero_pedido}` : `Pago parcial - ${formatUSD(walletAmountToUse)}`
        })
      }

      if (useWalletBs && walletBsAmountToUse > 0) {
        await supabase.rpc('pagar_con_billetera_bs_rpc', {
          p_user_id: targetUserId,
          p_amount: walletBsAmountToUse,
          p_pedido_id: pedidoId,
          p_description: isWalletBsOnly ? `Pago de pedido #${pedidoResult.data.numero_pedido}` : `Pago parcial (Bs) - ${formatBs(walletBsAmountToUse)}`
        })
      }

      if (activeRuletaDesc) {
        await supabase.from('ruleta_descuentos_pendientes').update({ usado: true, pedido_id: pedidoId }).eq('id', activeRuletaDesc.id)
      }

      playCashRegisterSound()
      setIsAutomaticResult(isGratis || isWalletOnly || isWalletBsOnly)
      setCreatedPedidoData(pedidoResult.data)
      setOrderFinished(true)
      // Ya no cerramos automáticamente en 15s para dar tiempo a Ver Pedido
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  if (orderFinished) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
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
              {/* REAL TIME TRACKING COMPONENT */}
              <OrderTracking pedidoInitial={createdPedidoData} onBack={onFinish} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <h1 className="page-title">Confirmación de la compra</h1>
        <p className="page-subtitle">
          {currentStep === 1 ? 'Revisa tus productos y selecciona cómo deseas pagar.' : 'Realiza el pago y coloca los datos.'}
        </p>
      </div>

      <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
        <div className="card">
          {currentStep === 1 ? (
            <>
              <div className="card-header">
                <h3 className="card-title">Resumen de Productos</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border-color)', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
                {cart.map(item => (
                  <div key={item.id} className="checkout-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', padding: '16px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-panel)' }}>
                      {item.icono_url ? <img src={item.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '📦'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{item.nombre}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{item.juego}</div>
                      <div className="checkout-details-box" style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', fontSize: '12px' }}>
                         {item.metodo_recarga === 'cuenta_completa' ? `📧 ${item.account_email}` : item.metodo_recarga === 'usuario_clave' ? `👤 ${item.account_user}` : `🆔 ${item.player_id}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {!isCliente && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.quantity} x {formatUSD(item.venta_usd)}</div>}
                      <div style={{ color: 'var(--accent-success)', fontWeight: 800 }}>{formatBs(item.venta_bs * item.quantity)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
             <div style={{ padding: '24px', textAlign: 'center' }}>
               <div style={{ fontSize: '40px', marginBottom: '16px' }}>⌛</div>
               <p>Esperando confirmación de {selectedMetodo?.nombre}</p>
               {expiresAt && <CountdownTimer expiryDate={expiresAt} onExpire={handleOrderExpired} />}
             </div>
          )}
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px' }}>
            <button className="btn btn-ghost" onClick={() => currentStep === 1 ? onFinish() : setCurrentStep(1)}>
              {currentStep === 1 ? 'Cancelar' : '← Atrás'}
            </button>
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <h3 className="card-title">Método de Pago</h3>
          </div>
          <div style={{ padding: '24px' }}>
            {currentStep === 1 ? (
              <>
                <div className="form-group mb-24" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {hasAnySaldo && !isGratis && !isCliente && (
                    <div onClick={handleToggleWalletPartial} className="checkout-toggle-card" style={{ border: `2px solid ${useWalletPartial ? 'var(--accent-success)' : 'var(--border-color)'}`, opacity: useWalletBs ? 0.5 : 1 }}>
                      <span>💵 Usar Saldo USD</span>
                      <small>Disp: {formatUSD(walletSaldo)}</small>
                    </div>
                  )}
                  {hasAnySaldoBs && !isGratis && (
                    <div onClick={handleToggleWalletBs} className="checkout-toggle-card" style={{ border: `2px solid ${useWalletBs ? '#a855f7' : 'var(--border-color)'}`, opacity: useWalletPartial ? 0.5 : 1 }}>
                      <span>🏦 Usar Saldo Bs</span>
                      <small>Disp: {formatBs(walletSaldoBs)}</small>
                    </div>
                  )}
                  {!isGratis && (
                    <div onClick={handleToggleRuletaDesc} className="checkout-toggle-card" style={{ border: `2px solid ${useRuletaDesc ? '#FFD700' : 'var(--border-color)'}`, opacity: ruletaDescuentos.length === 0 ? 0.5 : 1 }}>
                      <span>🎡 Descuento Ruleta</span>
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

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginBottom: '24px' }}>
                  {isGratis ? (
                    <div style={{ padding: '32px 24px', textAlign: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '24px', color: 'var(--accent-success)', border: '2px dashed var(--accent-success)' }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>¡Pedido Gratuito!</h3>
                      <p style={{ fontSize: '14px', opacity: 0.8 }}>Tu cupón cubre el 100% del total.</p>
                    </div>
                  ) : ((!useWalletPartial && !useWalletBs) || (!hasEnoughBalance && useWalletPartial) || (!hasEnoughBalanceBs && useWalletBs)) ? (
                    <>
                      {selectedMetodoId && !isWalletOnly && !isWalletBsOnly ? (
                        <div className="selected-method-details fade-in">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: 60, height: 60, borderRadius: '16px', backgroundColor: 'var(--bg-panel)', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                                <img src={selectedMetodo?.icono_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '18px', fontWeight: 800 }}>{selectedMetodo?.nombre}</span>
                                <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Datos para reportar:</span>
                              </div>
                            </div>
                            <button 
                              className="btn btn-ghost btn-sm" 
                              onClick={() => setSelectedMetodoId('')}
                              style={{ color: '#ff5252', border: '1px solid rgba(255, 82, 82, 0.15)', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}
                            >
                              <span style={{ marginRight: '4px' }}>✕</span> Cambiar
                            </button>
                          </div>

                          {selectedMetodo?.datos && (
                            <button 
                              className="btn btn-ghost btn-sm"
                              style={{ width: '100%', marginBottom: '16px', border: '1px dashed var(--accent-primary)', borderRadius: '12px', color: 'var(--accent-primary)', fontWeight: 700, padding: '12px' }}
                              onClick={(e) => {
                                navigator.clipboard.writeText(selectedMetodo.datos);
                                const btn = e.currentTarget;
                                btn.innerText = '✅ ¡Datos de Pago Copiados!';
                                setTimeout(() => { btn.innerText = '📋 Copiar Todos los Datos'; }, 2000);
                              }}
                            >
                              📋 Copiar Todos los Datos
                            </button>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                            {selectedMetodo?.datos.split('\n').filter(l => l.trim()).map((line, i) => (
                              <div key={i} style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '14px', 
                                border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                              }}>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{line}</span>
                                <button 
                                  onClick={() => {
                                    const val = line.split(':').slice(1).join(':').trim() || line;
                                    navigator.clipboard.writeText(val);
                                  }} 
                                  style={{ 
                                    padding: '8px', borderRadius: '10px', background: 'rgba(0, 210, 255, 0.05)', 
                                    border: '1px solid rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', 
                                    cursor: 'pointer', transition: 'all 0.2s'
                                  }}
                                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >📋</button>
                              </div>
                            ))}
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

                          <div className="form-group mb-16">
                            <label className="form-label" style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                              Número de Referencia <span style={{ fontSize: '10px', opacity: 0.8 }}>(Últimos 6 dígitos)</span>
                            </label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Últimos 6 dígitos de la referencia..."
                              value={referencia} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length > 6) {
                                  // Si se pegan más de 6, tomamos los últimos 6
                                  setReferencia(val.slice(-6));
                                } else {
                                  setReferencia(val);
                                }
                              }}
                              onPaste={e => {
                                e.preventDefault();
                                const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                                setReferencia(pasteData.slice(-6));
                              }}
                              style={{ border: '1px solid var(--accent-success)', borderRadius: '12px', height: '48px', padding: '0 16px' }}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>Adjuntar Comprobante (Opcional)</label>
                            <div style={{ 
                              padding: '16px', border: '2px dashed var(--border-color)', borderRadius: '16px', 
                              textAlign: 'center', position: 'relative', backgroundColor: 'rgba(255,255,255,0.02)',
                              transition: 'all 0.3s'
                            }}>
                              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{uploadingComprobante ? '⏳' : comprobanteUrl ? '✅' : '📤'}</div>
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>{uploadingComprobante ? 'Subiendo...' : comprobanteUrl ? 'Comprobante Listo' : 'Toca para subir captura'}</span>
                              <input type="file" accept="image/*" onChange={handleComprobanteUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="payment-methods-grid">
                          <label className="form-label" style={{ gridColumn: '1 / -1', marginBottom: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 700 }}>Selecciona un Método de Pago</label>
                          {metodos.filter(m => m.activo).map(m => (
                            <button key={m.id} onClick={() => handleSelectMetodo(m.id)} className={`payment-method-btn ${selectedMetodoId === m.id ? 'active' : ''}`} style={{ borderRadius: '20px', padding: '16px 10px' }}>
                              <div style={{ width: 64, height: 64, borderRadius: '16px', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', padding: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <img src={m.icono_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 700, display: 'block' }}>{m.nombre}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '24px', backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: '20px', border: '1px solid var(--accent-success)', color: 'var(--accent-success)', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                      <span style={{ fontWeight: 800, fontSize: '16px' }}>Pago Cubierto</span>
                      <p style={{ fontSize: '12px', marginTop: '4px' }}>El monto se descontará de tu billetera.</p>
                    </div>
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

            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Monto Total:</span>
                <span style={{ fontWeight: 700, textDecoration: activeRuletaDesc ? 'line-through' : 'none', opacity: activeRuletaDesc ? 0.5 : 1 }}>{formatUSD(totalUSD)}</span>
              </div>
              
              {activeRuletaDesc && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: '#FFD700' }}>
                  <span style={{ fontWeight: 600 }}>🎡 Descuento Ruleta:</span>
                  <span style={{ fontWeight: 800 }}>-{formatUSD(totalUSD - discountedTotalUSD)}</span>
                </div>
              )}

              {useWalletPartial && walletAmountToUse > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: 'var(--accent-success)' }}>
                  <span style={{ fontWeight: 600 }}>💵 Billetera USD:</span>
                  <span style={{ fontWeight: 800 }}>-{formatUSD(walletAmountToUse)}</span>
                </div>
              )}

              {useWalletBs && walletBsAmountToUse > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: '#a855f7' }}>
                  <span style={{ fontWeight: 600 }}>🏦 Billetera Bs:</span>
                  <span style={{ fontWeight: 800 }}>-{formatBs(walletBsAmountToUse)}</span>
                </div>
              )}

              <div style={{ borderTop: '2px dashed var(--border-color)', margin: '16px 0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '18px' }}>Total Pagar:</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent-success)', fontSize: '24px', fontWeight: 900, textShadow: '0 0 12px rgba(34, 197, 94, 0.3)' }}>
                    {useWalletBs && !hasEnoughBalanceBs ? formatBs(remainingBsFromWallet) : formatBs(remainingBs)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>{formatUSD(remainingUSD)}</div>
                </div>
              </div>

              <button 
                className="btn btn-primary btn-lg" 
                style={{ 
                  width: '100%', marginTop: '20px', height: '64px', fontSize: '18px', fontWeight: 800,
                  borderRadius: '18px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)',
                  boxShadow: '0 8px 24px rgba(0, 180, 255, 0.4)', border: 'none', color: 'white',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: isProcessing ? 'default' : 'pointer'
                }}
                disabled={isProcessing || (!isGratis && !isWalletOnly && !isWalletBsOnly && selectedMetodoId && !referencia.trim())}
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
            </div>
          </div>
        </div>
      </div>
    </div>
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
