import React, { useState, useMemo, useEffect } from 'react'
import { useCart, useVentas, useMetodosPago, useAuth, useWallet } from '../hooks/useData'
import { formatUSD, formatBs, playCashRegisterSound } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import { useConfiguracion } from '../hooks/useData'

export default function Checkout({ onFinish }) {
  const { cart, removeFromCart, clearCart, checkout, totalUSD, totalBs } = useCart()
  const { registrarVenta } = useVentas()
  const { metodos, loading: loadingMetodos } = useMetodosPago()
  const { perfil, user } = useAuth()
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

  // Descuentos ganados en la ruleta (pendientes de usar)
  const [ruletaDescuentos, setRuletaDescuentos] = useState([])
  const [selectedRuletaDesc, setSelectedRuletaDesc] = useState(null)
  
  // Cerramos el checkout si el carrito se queda vacío tras una eliminación
  useEffect(() => {
    if (!orderFinished && cart.length === 0) {
      onFinish();
    }
  }, [cart, orderFinished, onFinish]);

  useEffect(() => {
    // 1. Prioridad: user.id (UUID de auth)
    // 2. Fallback: perfil.cliente_uuid (UUID de la tabla clientes)
    const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id
    if (!targetUserId) return

    const fetchDiscounts = async () => {
      console.log("🔍 Buscando descuentos de ruleta para:", targetUserId)
      const { data, error } = await supabase
        .from('ruleta_descuentos_pendientes')
        .select('id,nombre,porcentaje')
        .eq('cliente_id', targetUserId)
        .eq('usado', false)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error("❌ Error cargando descuentos de ruleta:", error)
      } else {
        console.log("✅ Descuentos encontrados:", data?.length || 0, data)
        setRuletaDescuentos(data || [])
      }
    }

    fetchDiscounts()

    // Suscripción Realtime para detectar cuando el usuario gana un premio mientras tiene el checkout abierto
    const channel = supabase
      .channel(`ruleta_desc_${targetUserId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ruleta_descuentos_pendientes',
        filter: `cliente_id=eq.${targetUserId}`
      }, (payload) => {
        console.log('🔔 Cambio detectado en descuentos de ruleta:', payload.eventType)
        fetchDiscounts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, perfil?.id, perfil?.cliente_uuid])

  const currentClienteId = user?.id || perfil?.id || null
  const walletSaldo = wallet?.saldo || 0
  const walletSaldoBs = wallet?.saldo_bs || 0

  // Totales: aplica descuento de ruleta si está activado y hay uno seleccionado
  const activeRuletaDesc = useRuletaDesc ? selectedRuletaDesc : null
  const ruletaFactor = activeRuletaDesc ? (1 - activeRuletaDesc.porcentaje / 100) : 1
  const discountedTotalUSD = +(totalUSD * ruletaFactor).toFixed(2)
  const discountedTotalBs  = Math.round(totalBs * ruletaFactor)

  const isGratis = discountedTotalUSD <= 0

  const hasEnoughBalance = walletSaldo >= discountedTotalUSD
  const hasAnySaldo = walletSaldo > 0
  const hasEnoughBalanceBs = walletSaldoBs >= discountedTotalBs
  const hasAnySaldoBs = walletSaldoBs > 0

  // Calcular montos con pago parcial de billetera (USD)
  const walletAmountToUse = useWalletPartial ? Math.min(walletSaldo, discountedTotalUSD) : 0
  const remainingUSD = discountedTotalUSD - walletAmountToUse
  const tasaDolar = Number(config?.tasa_dolar) || 1
  const remainingBs = Math.round(remainingUSD * tasaDolar)

  // Calcular montos con pago Bs
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
    // Mutually exclusive with Bs wallet
    if (newVal) setUseWalletBs(false)
    if (newVal && hasEnoughBalance) {
      setSelectedMetodoId('wallet')
    }
    if (!newVal && selectedMetodoId === 'wallet') {
      setSelectedMetodoId('')
    }
  }

  const handleToggleWalletBs = () => {
    if (!hasAnySaldoBs) return
    const newVal = !useWalletBs
    setUseWalletBs(newVal)
    // Mutually exclusive with USD wallet
    if (newVal) setUseWalletPartial(false)
    if (newVal && hasEnoughBalanceBs) {
      setSelectedMetodoId('wallet_bs')
    }
    if (!newVal && selectedMetodoId === 'wallet_bs') {
      setSelectedMetodoId('')
    }
  }

  const handleSelectMetodo = (id) => {
    // Si selecciona un método normal, desactivar wallet-only
    if (id !== 'wallet') {
      setSelectedMetodoId(id)
      // Si tiene saldo parcial, mantenerlo activado
    } else {
      // Solo permitir wallet-only si tiene saldo completo
      if (hasEnoughBalance) {
        setSelectedMetodoId('wallet')
        setUseWalletPartial(true)
      }
    }
  }

  const handleToggleRuletaDesc = () => {
    if (ruletaDescuentos.length === 0) {
      // Intentar refetch manual
      const targetUserId = user?.id || perfil?.cliente_uuid || perfil?.id
      if (targetUserId) {
        supabase
          .from('ruleta_descuentos_pendientes')
          .select('id,nombre,porcentaje')
          .eq('cliente_id', targetUserId)
          .eq('usado', false)
          .then(({ data }) => data && setRuletaDescuentos(data))
      }
      return
    }
    const newVal = !useRuletaDesc
    setUseRuletaDesc(newVal)
    if (newVal && ruletaDescuentos.length > 0 && !selectedRuletaDesc) {
      setSelectedRuletaDesc(ruletaDescuentos[0])
    }
  }


  const handleNextStep = () => {
    if (isGratis) {
      handleFinalizar()
      return
    }

    // Validar que tiene método seleccionado
    if (!selectedMetodoId && !useWalletPartial && !useWalletBs) {
      alert('Por favor selecciona un método de pago.')
      return
    }
    // Si billetera parcial activada pero no seleccionó método para el resto
    if (useWalletPartial && !hasEnoughBalance && !selectedMetodoId) {
      alert('Por favor selecciona un método de pago para el monto restante.')
      return
    }
    if (useWalletBs && !hasEnoughBalanceBs && !selectedMetodoId) {
      alert('Por favor selecciona un método de pago para el monto restante en Bs.')
      return
    }
    
    // Si pago completo con billetera, finalizar directo
    if ((isWalletOnly && hasEnoughBalance) || (isWalletBsOnly && hasEnoughBalanceBs)) {
      handleFinalizar()
      return
    }

    setCurrentStep(2)
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

      // Normalizar datos si es gratis, o se usa billetera
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

      // 1. Registrar el pedido PRIMERO para obtener su ID
      const results = await checkout(registrarVenta, currentClienteId, finalMetodoId, finalReferencia, null, activeRuletaDesc)
      const pedidoResult = results.find(r => r.id === 'pedido')
      
      if (!pedidoResult || pedidoResult.error) {
        throw new Error(pedidoResult?.error || 'No se pudo crear el pedido')
      }

      const createdPedido = pedidoResult.data;
      const pedidoId = createdPedido.id;

      // 2. Si usa billetera USD (parcial o total), descontar saldo ahora que tenemos el pedidoId
      if (useWalletPartial && walletAmountToUse > 0) {
        const { data: payData, error: payError } = await supabase.rpc('pagar_con_billetera_rpc', {
          p_user_id: user.id,
          p_amount: walletAmountToUse,
          p_pedido_id: pedidoId,
          p_description: isWalletOnly 
            ? `Pago de pedido #${createdPedido.numero_pedido} (Billetera USD)` 
            : `Pago parcial de pedido #${createdPedido.numero_pedido} - ${formatUSD(walletAmountToUse)}`
        })

        if (payError || !payData) {
          // Nota: El pedido ya se creó, informamos al usuario si el pago falló
          console.error("Error debitando wallet USD:", payError)
          alert("Aviso: El pedido fue registrado pero hubo un error al descontar de tu billetera USD. Contacta a soporte.")
        }
      }

      // 2b. Si usa billetera Bs (parcial o total), descontar saldo Bs
      if (useWalletBs && walletBsAmountToUse > 0) {
        const { data: payDataBs, error: payErrorBs } = await supabase.rpc('pagar_con_billetera_bs_rpc', {
          p_user_id: user.id,
          p_amount: walletBsAmountToUse,
          p_pedido_id: pedidoId,
          p_description: isWalletBsOnly 
            ? `Pago de pedido #${createdPedido.numero_pedido} (Billetera Bs)` 
            : `Pago parcial de pedido #${createdPedido.numero_pedido} (Bs) - ${formatBs(walletBsAmountToUse)}`
        })

        if (payErrorBs || !payDataBs) {
          console.error("Error debitando wallet Bs:", payErrorBs)
          alert("Aviso: El pedido fue registrado pero hubo un error al descontar de tu billetera de Bolívares. Contacta a soporte.")
        }
      }

      // 3. Marcar descuento de ruleta como usado
      if (activeRuletaDesc) {
        await supabase
          .from('ruleta_descuentos_pendientes')
          .update({ usado: true, pedido_id: pedidoId })
          .eq('id', activeRuletaDesc.id)
          .eq('cliente_id', user.id)
      }

      playCashRegisterSound()
      setOrderFinished(true)
      setTimeout(() => {
        if (onFinish) onFinish()
      }, 15000)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  if (orderFinished) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px', maxWidth: '500px', animation: 'bounceIn 0.5s' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <img 
              src="/assets/Verificando.PNG.png" 
              alt="Verificando Pago" 
              style={{ width: '140px', height: '140px', objectFit: 'contain' }} 
            />
          </div>
          <h2 className="card-title" style={{ fontSize: '28px', color: 'var(--accent-success)' }}>¡Verificando Pago!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', whiteSpace: 'pre-line' }}>
            Tu pedido se ha registrado exitosamente. En estos momentos su pago se está verificando.{"\n\n"}
            Puedes consultar el estado de tu pedido en la sección "Mis Pedidos".{"\n\n"}
            Recuerda que el proceso de recarga es realizado en un tiempo comprendido entre 5 a 20 minutos.
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
          {currentStep === 1 
            ? 'Revisa tus productos y selecciona cómo deseas pagar.' 
            : 'Realiza el pago y coloca los datos solicitados.'}
        </p>
      </div>

      <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
        {/* COLUMNA IZQUIERDA: RESUMEN O DATOS DE PAGO */}
        <div className="card">
          {currentStep === 1 ? (
            <>
              <div className="card-header">
                <h3 className="card-title">Resumen de Productos</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border-color)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {cart.map(item => (
                  <div key={item.id} className="checkout-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-panel)', flexShrink: 0 }}>
                      {item.icono_url ? <img src={item.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '📦'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="checkout-item-name" style={{ fontWeight: 'bold' }}>{item.nombre}</div>
                      <div className="checkout-item-juego" style={{ color: 'var(--text-muted)' }}>{item.juego}</div>
                      <div style={{ fontSize: 13, color: 'var(--accent-primary)', textTransform: 'uppercase', marginTop: 4 }}>
                        Requisito: {item.metodo_recarga === 'cuenta_completa' ? '🔐 Cuenta' : item.metodo_recarga === 'usuario_clave' ? '👤 Usuario' : '🆔 ID'}
                      </div>
                      <div className="checkout-details-box" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {item.metodo_recarga === 'cuenta_completa' ? (
                          <>
                            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Correo:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_email || 'No proporcionado'}</span></div>
                            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Clave:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_password || 'No proporcionada'}</span></div>
                          </>
                        ) : item.metodo_recarga === 'usuario_clave' ? (
                          <>
                            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Usuario:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_user || 'No proporcionado'}</span></div>
                            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Clave:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_password || 'No proporcionada'}</span></div>
                          </>
                        ) : (
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>ID Jugador:</span> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.player_id || 'No proporcionado'}</span></div>
                        )}
                      </div>
                    </div>
                    <div className="checkout-item-price" style={{ textAlign: 'right' }}>
                      <div className="checkout-price-usd" style={{ fontWeight: 600 }}>{item.quantity} x {formatUSD(item.venta_usd)}</div>
                      <div className="checkout-price-bs" style={{ color: 'var(--accent-success)', fontWeight: 800 }}>{formatBs(item.venta_bs * item.quantity)}</div>
                    </div>
                    {/* Botón Eliminar Individual */}
                    {!isProcessing && (
                      <button 
                        className="btn-remove-checkout-item" 
                        onClick={() => removeFromCart(item.cart_id)}
                        title="Eliminar del pedido"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ 
                  width: '100px', height: '100px', borderRadius: '30px', backgroundColor: 'rgba(0, 210, 255, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', margin: '0 auto 24px',
                  overflow: 'hidden', border: '1px solid var(--border-color)'
                }}>
                  {selectedMetodo?.icono_url ? (
                    <img src={selectedMetodo.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span>
                      {selectedMetodo?.nombre.toLowerCase().includes('zelle') ? '🟣' : 
                       selectedMetodo?.nombre.toLowerCase().includes('pago') ? '📱' : 
                       selectedMetodo?.nombre.toLowerCase().includes('binance') ? '🟡' : '💳'}
                    </span>
                  )}
                </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Pagar con {selectedMetodo?.nombre}</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Utiliza los siguientes datos para realizar tu transferencia:</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                {selectedMetodo?.datos.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <div key={idx} className="payment-detail-row">
                    <div className="payment-detail-text">
                      {line.includes('Banco:') ? '🏦 ' : line.includes('Teléfono:') ? '📱 ' : line.includes('Cédula:') ? '🆔 ' : line.includes('Pago:') ? '📱 ' : ''}
                      {line}
                    </div>
                    <button 
                      className="copy-btn-new"
                      onClick={(e) => {
                        const textToCopy = line.split(':').slice(1).join(':').trim() || line.trim();
                        navigator.clipboard.writeText(textToCopy);
                        const btn = e.currentTarget;
                        const originalText = btn.innerText;
                        btn.innerText = '¡Copiado!';
                        btn.style.backgroundColor = 'var(--accent-success)';
                        setTimeout(() => {
                          btn.innerText = originalText;
                          btn.style.backgroundColor = 'var(--accent-primary)';
                        }, 2000);
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                ))}
              </div>

              {selectedMetodo?.qr_url && (
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div className="qr-container-new">
                    <img src={selectedMetodo.qr_url} alt="QR Pago" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Escanea este código QR para realizar el pago</p>
                </div>
              )}

              {useWalletPartial && walletAmountToUse > 0 && (
                <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>
                  💼 Se descontarán {formatUSD(walletAmountToUse)} de tu billetera. Solo debes pagar {formatUSD(remainingUSD)} por este método.
                </div>
              )}

              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(255, 171, 0, 0.1)', borderRadius: '12px', color: '#ffab00', fontSize: '14px' }}>
                ⚠️ Una vez realizado el pago, completa los datos de recarga y el número de referencia a la derecha.
              </div>
            </div>
          )}
          
          <div className="card-footer" style={{ borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={() => currentStep === 1 ? onFinish() : setCurrentStep(1)}>
              {currentStep === 1 ? 'Cancelar Pedido' : '← Volver a selección'}
            </button>
            {currentStep === 1 && <span style={{ color: 'var(--text-muted)' }}>{cart.length} productos en lista</span>}
          </div>
        </div>

        {/* COLUMNA DERECHA: SELECCIÓN O DATOS/REFERENCIA */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <h3 className="card-title">{currentStep === 1 ? 'Método de Pago' : 'Comprobante de Pago'}</h3>
          </div>
          <div style={{ padding: '24px' }}>
            {currentStep === 1 ? (
              <div className="form-group mb-24">
                {/* Toggle de Billetera USD */}
                {hasAnySaldo && !isGratis && (
                  <div 
                    onClick={handleToggleWalletPartial}
                    className="checkout-toggle-card"
                    style={{
                      backgroundColor: useWalletPartial ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-panel)',
                      border: `2px solid ${useWalletPartial ? 'var(--accent-success)' : 'var(--border-color)'}`,
                      opacity: useWalletBs ? 0.4 : 1, pointerEvents: useWalletBs ? 'none' : 'auto'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '22px' }}>💵</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '18px' }}>Usar saldo USD</div>
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                          Disponible: <span style={{ color: 'var(--accent-success)', fontWeight: 800 }}>{formatUSD(walletSaldo)}</span>
                          {useWalletPartial && !hasEnoughBalance && (
                            <span style={{ color: 'var(--accent-primary)', marginLeft: '8px' }}>
                              → Aplica {formatUSD(walletAmountToUse)}, resta {formatUSD(remainingUSD)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      backgroundColor: useWalletPartial ? 'var(--accent-success)' : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'all 0.3s ease', flexShrink: 0,
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute', top: '2px',
                        left: useWalletPartial ? '22px' : '2px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>
                )}

                {/* Toggle de Billetera Bs */}
                {hasAnySaldoBs && !isGratis && (
                  <div 
                    onClick={handleToggleWalletBs}
                    className="checkout-toggle-card"
                    style={{
                      backgroundColor: useWalletBs ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-panel)',
                      border: `2px solid ${useWalletBs ? '#8b5cf6' : 'var(--border-color)'}`,
                      opacity: useWalletPartial ? 0.4 : 1, pointerEvents: useWalletPartial ? 'none' : 'auto'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '22px' }}>🏦</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '18px' }}>Usar saldo Bolívares</div>
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                          Disponible: <span style={{ color: '#a855f7', fontWeight: 800 }}>{formatBs(walletSaldoBs)}</span>
                          {useWalletBs && !hasEnoughBalanceBs && (
                            <span style={{ color: '#a855f7', marginLeft: '8px' }}>
                              → Aplica {formatBs(walletBsAmountToUse)}, resta {formatBs(remainingBsFromWallet)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      backgroundColor: useWalletBs ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'all 0.3s ease', flexShrink: 0,
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute', top: '2px',
                        left: useWalletBs ? '22px' : '2px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>
                )}

                {/* SECCIÓN DE DESCUENTOS DE RULETA */}
                {!isGratis && (
                  <div 
                    onClick={handleToggleRuletaDesc}
                    className="checkout-toggle-card ruleta-toggle"
                    style={{
                      backgroundColor: useRuletaDesc ? 'rgba(255, 215, 0, 0.08)' : 'var(--bg-panel)',
                      border: `2px solid ${useRuletaDesc ? '#FFD700' : 'var(--border-color)'}`,
                      cursor: ruletaDescuentos.length > 0 ? 'pointer' : 'default', 
                      opacity: ruletaDescuentos.length === 0 ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '22px' }}>🎡</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Descuento de Ruleta
                          {ruletaDescuentos.length === 0 && (
                            <span 
                              style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 400 }}
                              onClick={(e) => { e.stopPropagation(); handleToggleRuletaDesc(); }}
                            >🔄 Actualizar</span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {ruletaDescuentos.length > 0 
                            ? `${ruletaDescuentos.length} disponible${ruletaDescuentos.length !== 1 ? 's' : ''}`
                            : 'No tienes cupones pendientes (vuelve a la ruleta si ganaste)'}
                        </div>
                      </div>
                    </div>
                    {ruletaDescuentos.length > 0 && (
                      <div style={{
                        width: '44px', height: '24px', borderRadius: '12px',
                        backgroundColor: useRuletaDesc ? '#FFD700' : 'rgba(255,255,255,0.1)',
                        position: 'relative', transition: 'all 0.3s ease', flexShrink: 0,
                      }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          backgroundColor: 'white',
                          position: 'absolute', top: '2px',
                          left: useRuletaDesc ? '22px' : '2px',
                          transition: 'all 0.3s ease'
                        }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de descuentos si el toggle está activo */}
                {useRuletaDesc && ruletaDescuentos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', padding: '0 4px' }}>
                    {ruletaDescuentos.map(d => (
                      <div key={d.id}
                        onClick={() => setSelectedRuletaDesc(d)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 16px', borderRadius: '14px', cursor: 'pointer',
                          border: `2px solid ${activeRuletaDesc?.id === d.id ? '#FFD700' : 'rgba(255,215,0,.1)'}`,
                          background: activeRuletaDesc?.id === d.id ? 'rgba(255,215,0,.12)' : 'var(--bg-panel)',
                          transition: 'all .2s'
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {activeRuletaDesc?.id === d.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD700' }} />}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{d.nombre}</div>
                        </div>
                        <span style={{ fontWeight: 900, fontSize: '18px', color: '#FFD700' }}>-{d.porcentaje}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Opciones cuando es gratis */}
                {isGratis && (
                   <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '16px', color: 'var(--accent-success)', border: '2px dashed var(--accent-success)' }}>
                     <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
                     <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>¡Pedido Gratuito!</h3>
                     <p style={{ marginTop: '8px' }}>Tu cupón cubre el 100% del pedido. Puedes finalizar tu pedido directamente.</p>
                   </div>
                )}

                {/* Métodos de pago (solo si necesita pagar algo más) */}
                {!isGratis && ((!useWalletPartial && !useWalletBs) || (!hasEnoughBalance && useWalletPartial) || (!hasEnoughBalanceBs && useWalletBs)) ? (
                  <>
                    <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>
                      {useWalletPartial && !hasEnoughBalance 
                        ? `Método de pago para el restante (${formatUSD(remainingUSD)})` 
                        : useWalletBs && !hasEnoughBalanceBs 
                        ? `Método de pago para el restante (${formatBs(remainingBsFromWallet)})` 
                        : 'Seleccionar Método de Pago'}
                    </label>
                    <div className="payment-methods-grid">
                      {metodos.filter(m => m.activo).map(m => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMetodo(m.id)}
                          className={`payment-method-btn ${selectedMetodoId === m.id ? 'active' : ''}`}
                        >
                          <div style={{ 
                            width: '84px', height: '84px', borderRadius: '18px', 
                            backgroundColor: 'var(--bg-card)', padding: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                          }}>
                            {m.icono_url ? (
                              <img src={m.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: '30px' }}>
                                {m.nombre.toLowerCase().includes('zelle') ? '🟣' : 
                                 m.nombre.toLowerCase().includes('pago') ? '📱' : 
                                 m.nombre.toLowerCase().includes('binance') ? '🟡' : '💳'}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <>
                <div className="form-group mb-24" style={{ paddingTop: 8 }}>
                  <label className="form-label" style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>Coloca la referencia de tu pago aquí</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Número de comprobante..."
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </div>
              </>
            )}
            {/* Resumen de Montos */}
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '20px', borderRadius: '16px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monto Total:</span>
                <span style={{ fontWeight: 600, textDecoration: activeRuletaDesc ? 'line-through' : 'none', color: activeRuletaDesc ? 'var(--text-muted)' : 'inherit' }}>
                  {formatUSD(totalUSD)}
                </span>
              </div>

              {activeRuletaDesc && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#FFD700' }}>🎡 Descuento Ruleta ({activeRuletaDesc.porcentaje}%):</span>
                  <span style={{ fontWeight: 700, color: '#FFD700' }}>-{formatUSD(totalUSD - discountedTotalUSD)}</span>
                </div>
              )}
              
              {useWalletPartial && walletAmountToUse > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--accent-success)' }}>💼 Descuento Billetera:</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-success)' }}>-{formatUSD(walletAmountToUse)}</span>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0' }} />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 600 }}>
                  {(useWalletPartial && !hasEnoughBalance) ? 'A pagar:' : (useWalletBs && !hasEnoughBalanceBs) ? 'A pagar (Bs):' : 'Total Bs:'}
                </span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: isWalletBsOnly ? '#a855f7' : 'var(--accent-success)' }}>
                  {isWalletOnly && hasEnoughBalance 
                    ? formatUSD(0) + ' (Billetera USD)' 
                    : isWalletBsOnly && hasEnoughBalanceBs
                    ? formatBs(0) + ' (Billetera Bs)'
                    : useWalletBs && !hasEnoughBalanceBs
                    ? formatBs(remainingBsFromWallet)
                    : formatBs(remainingBs)}
                </span>
              </div>
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%', height: '56px', fontSize: '18px', boxShadow: '0 8px 24px rgba(0, 210, 255, 0.3)' }}
              disabled={
                isProcessing || 
                (currentStep === 1 && !selectedMetodoId && !(useWalletPartial && hasEnoughBalance) && !(useWalletBs && hasEnoughBalanceBs) && !isGratis) || 
                (currentStep === 2 && !referencia && !isGratis)
              }
              onClick={currentStep === 1 ? handleNextStep : handleFinalizar}
            >
              {isProcessing ? 'Procesando...' : (currentStep === 1 && !isGratis) ? 'Confirmar y Pagar' : 'Finalizar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
