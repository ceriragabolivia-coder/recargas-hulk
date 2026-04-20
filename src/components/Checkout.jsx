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
  const { registrarVenta } = useVentas()
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
  
  // Cerramos el checkout si el carrito se queda vacío tras una eliminación
  useEffect(() => {
    if (!orderFinished && cart.length === 0 && currentStep === 1) {
      onFinish();
    }
  }, [cart, orderFinished, onFinish, currentStep]);

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

      if (useWalletPartial && walletAmountToUse > 0) {
        await supabase.rpc('pagar_con_billetera_rpc', {
          p_user_id: user.id,
          p_amount: walletAmountToUse,
          p_pedido_id: pedidoId,
          p_description: isWalletOnly ? `Pago de pedido #${pedidoResult.data.numero_pedido}` : `Pago parcial - ${formatUSD(walletAmountToUse)}`
        })
      }

      if (useWalletBs && walletBsAmountToUse > 0) {
        await supabase.rpc('pagar_con_billetera_bs_rpc', {
          p_user_id: user.id,
          p_amount: walletBsAmountToUse,
          p_pedido_id: pedidoId,
          p_description: isWalletBsOnly ? `Pago de pedido #${pedidoResult.data.numero_pedido}` : `Pago parcial (Bs) - ${formatBs(walletBsAmountToUse)}`
        })
      }

      if (activeRuletaDesc) {
        await supabase.from('ruleta_descuentos_pendientes').update({ usado: true, pedido_id: pedidoId }).eq('id', activeRuletaDesc.id)
      }

      playCashRegisterSound()
      setOrderFinished(true)
      setTimeout(() => { if (onFinish) onFinish() }, 15000)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  if (orderFinished) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px', maxWidth: '500px' }}>
          <div style={{ marginBottom: '24px' }}>
            <img src="/assets/Verificando.PNG.png" alt="Verificación" style={{ width: '140px' }} />
          </div>
          <h2 style={{ color: 'var(--accent-success)' }}>¡Pago Verificando!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            Tu pedido se ha registrado exitosamente. En estos momentos su pago se está verificando.{"\n\n"}
            Puedes consultar el estado en "Mis Pedidos".{"\n\n"}
            Tiempo estimado: 5 a 20 minutos.
          </p>
          <button className="btn btn-primary" onClick={onFinish}>Volver al Inicio</button>
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
                     <div style={{ padding: '16px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', textAlign: 'center' }}>🎉 ¡Pago Cubierto!</div>
                   ) : ((!useWalletPartial && !useWalletBs) || (!hasEnoughBalance && useWalletPartial) || (!hasEnoughBalanceBs && useWalletBs)) ? (
                      selectedMetodoId && !isWalletOnly && !isWalletBsOnly ? (
                        <div className="selected-method-details" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--accent-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                             <span style={{ fontWeight: 'bold' }}>{selectedMetodo?.nombre}</span>
                             <button className="btn btn-sm btn-ghost" onClick={() => setSelectedMetodoId('')}>Cambiar</button>
                          </div>
                          <div style={{ fontSize: '13px', marginBottom: '16px', whiteSpace: 'pre-line' }}>{selectedMetodo?.datos}</div>
                          {selectedMetodo?.datos && (
                            <button className="btn btn-sm btn-ghost" style={{ width: '100%', marginBottom: '16px' }} onClick={() => { navigator.clipboard.writeText(selectedMetodo.datos); alert('Copiado'); }}>📋 Copiar Datos</button>
                          )}
                          <input type="text" className="form-input" placeholder="Referencia..." value={referencia} onChange={e => setReferencia(e.target.value)} style={{ marginBottom: '12px' }} />
                          <div style={{ position: 'relative', border: '2px dashed var(--border-color)', padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
                             {uploadingComprobante ? '⏳ Subiendo...' : comprobanteUrl ? '✅ Capture Listo' : '📤 Subir Capture'}
                             <input type="file" accept="image/*" onChange={handleComprobanteUpload} style={{ position: 'absolute', inset: 0, opacity: 0 }} />
                          </div>
                        </div>
                      ) : (
                        <div className="payment-methods-grid">
                          {metodos.filter(m => m.activo).map(m => (
                            <button key={m.id} onClick={() => handleSelectMetodo(m.id)} className={`payment-method-btn ${selectedMetodoId === m.id ? 'active' : ''}`}>
                               <div style={{ width: 44, height: 44, margin: '0 auto 8px', backgroundColor: 'white', borderRadius: 8, padding: 4 }}>
                                  <img src={m.icono_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                               </div>
                               <span style={{ fontSize: '11px' }}>{m.nombre}</span>
                            </button>
                          ))}
                        </div>
                      )
                   ) : (
                     <div style={{ padding: '16px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px' }}>✅ Saldo suficiente</div>
                   )}
                </div>
              </>
            ) : (
               <div style={{ padding: '40px', textAlign: 'center' }}>Esperando Pago...</div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                 <span>Subtotal:</span>
                 <span style={{ textDecoration: activeRuletaDesc ? 'line-through' : 'none' }}>{formatUSD(totalUSD)}</span>
               </div>
               {activeRuletaDesc && <div style={{ color: '#FFD700', fontSize: '13px', marginBottom: '8px' }}>Descuento Ruleta: -{formatUSD(totalUSD - discountedTotalUSD)}</div>}
               {useWalletPartial && <div style={{ color: 'var(--accent-success)', fontSize: '13px', marginBottom: '8px' }}>Billetera USD: -{formatUSD(walletAmountToUse)}</div>}
               {useWalletBs && <div style={{ color: '#a855f7', fontSize: '13px', marginBottom: '8px' }}>Billetera Bs: -{formatBs(walletBsAmountToUse)}</div>}
               <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', marginTop: '12px' }}>
                 <span>Total:</span>
                 <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--accent-success)' }}>{useWalletBs ? formatBs(remainingBsFromWallet) : formatBs(remainingBs)}</div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatUSD(remainingUSD)}</small>
                 </div>
               </div>
               <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '20px' }} disabled={isProcessing || (!isGratis && !isWalletOnly && !isWalletBsOnly && selectedMetodoId && !referencia.trim())} onClick={handleFinalizar}>
                 {isProcessing ? 'Procesando...' : 'Finalizar Pedido'}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
