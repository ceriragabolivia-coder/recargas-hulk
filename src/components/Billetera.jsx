import React, { useState, useEffect, useMemo } from 'react'
import { useWallet, useAuth, useMetodosPago, useVentas, useConfiguracion } from '../hooks/useData'
import { formatUSD, formatBs, getOptimizedImageUrl } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'
import { compressImage } from '../utils/imageCompression'

export default function Billetera({ onNavigate }) {
  const { wallet, adminSalesBalance, recargas, transacciones, loading, solicitarRecarga, refetch } = useWallet()
  const { perfil, isCliente, user } = useAuth()
  const { metodos } = useMetodosPago()
  const { config } = useConfiguracion()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'
  const { verificarYRegistrarReferencia } = useVentas()

  const montosBsFijos = useMemo(() => {
    if (!config?.montos_billetera_bs) return []
    return config.montos_billetera_bs.split(',').map(v => v.trim()).filter(v => !isNaN(v) && v !== '')
  }, [config?.montos_billetera_bs])

  const montosUsdFijos = useMemo(() => {
    if (!config?.montos_billetera_usd) return []
    return config.montos_billetera_usd.split(',').map(v => v.trim()).filter(v => !isNaN(v) && v !== '')
  }, [config?.montos_billetera_usd])

  const [monto, setMonto] = useState('')
  const [monedaRecarga, setMonedaRecarga] = useState('bs') // Cambiado a 'bs' por defecto
  const [metodoId, setMetodoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const [selectedComprobante, setSelectedComprobante] = useState(null) // Modal para ver el comprobante de pago
  const [selectedOrder, setSelectedOrder] = useState(null) // Modal para ver detalle de pedido
  const [loadingOrder, setLoadingOrder] = useState(false)

  // Estado para solicitudes pendientes (Solo Admin)
  const [pendingRecargas, setPendingRecargas] = useState([])
  const [approvedRecargas, setApprovedRecargas] = useState([])
  const [rejectedRecargas, setRejectedRecargas] = useState([])
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  const hasWalletUSD = useMemo(() => {
    if (isAdmin) return true;
    if (perfil?.rol === 'revendedor') return !(perfil.config_modulos || []).includes('disable_wallet_usd');
    return (perfil?.config_modulos || []).includes('enable_wallet_usd');
  }, [isAdmin, perfil]);

  const hasWalletBs = useMemo(() => {
    if (isAdmin) return true;
    return !(perfil?.config_modulos || []).includes('disable_wallet_bs');
  }, [isAdmin, perfil]);

  const fetchPendingRecargas = async () => {
    if (!isAdmin) return
    setLoadingAdmin(true)
    // 1. Obtener recargas pendientes (sin join problemático)
    const { data: rawRecargas } = await supabase
      .from('billetera_recargas')
      .select('*, metodos_pago(nombre)')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })

    if (rawRecargas && rawRecargas.length > 0) {
      // 2. Obtener datos de usuarios involucrados
      const userIds = [...new Set(rawRecargas.map(r => r.auth_user_id))]
      const { data: usersData } = await supabase
        .from('clientes')
        .select('auth_user_id, nombres, apellidos, nickname')
        .in('auth_user_id', userIds)
      const userMap = new Map((usersData || []).map(u => [u.auth_user_id, u]))
      // 3. Mapear manualmente
      setPendingRecargas(rawRecargas.map(r => ({ ...r, clientes: userMap.get(r.auth_user_id) })))
    } else {
      setPendingRecargas([])
    }

    // También obtener recargas aprobadas recientes para posible reversión
    const { data: rawApproved } = await supabase
      .from('billetera_recargas')
      .select('*, metodos_pago(nombre)')
      .eq('estado', 'aprobado')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (rawApproved && rawApproved.length > 0) {
      const approvedUserIds = [...new Set(rawApproved.map(r => r.auth_user_id))]
      const { data: approvedUsersData } = await supabase
        .from('clientes')
        .select('auth_user_id, nombres, apellidos, nickname')
        .in('auth_user_id', approvedUserIds)
      const approvedUserMap = new Map((approvedUsersData || []).map(u => [u.auth_user_id, u]))
      setApprovedRecargas(rawApproved.map(r => ({ ...r, clientes: approvedUserMap.get(r.auth_user_id) })))
    } else {
      setApprovedRecargas([])
    }

    // También obtener recargas rechazadas recientes
    const { data: rawRejected } = await supabase
      .from('billetera_recargas')
      .select('*, metodos_pago(nombre)')
      .eq('estado', 'rechazado')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (rawRejected && rawRejected.length > 0) {
      const rejectedUserIds = [...new Set(rawRejected.map(r => r.auth_user_id))]
      const { data: rejectedUsersData } = await supabase
        .from('clientes')
        .select('auth_user_id, nombres, apellidos, nickname')
        .in('auth_user_id', rejectedUserIds)
      const rejectedUserMap = new Map((rejectedUsersData || []).map(u => [u.auth_user_id, u]))
      setRejectedRecargas(rawRejected.map(r => ({ ...r, clientes: rejectedUserMap.get(r.auth_user_id) })))
    } else {
      setRejectedRecargas([])
    }

    setLoadingAdmin(false)
  }

  const fetchAdminSalesBalance = async () => {
    if (!isAdmin || !perfil?.id) return
    const { data } = await supabase
      .from('admin_saldos')
      .select('saldo_usd, saldo_bs')
      .eq('auth_user_id', perfil.id)
      .maybeSingle()
    
    if (data) {
      setAdminSalesBalance({ usd: data.saldo_usd, bs: data.saldo_bs })
    }
  }

  const handleViewOrder = async (orderId) => {
    if (!orderId) return
    setLoadingOrder(true)
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*)')
        .eq('id', orderId)
        .single()
      
      if (error) throw error
      setSelectedOrder(data)
    } catch (err) {
      console.error("Error fetching order detail:", err)
      setAlertModal({ type: 'error', message: 'No se pudo cargar el detalle del pedido.' })
    } finally {
      setLoadingOrder(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchPendingRecargas()
    }
  }, [isAdmin, perfil?.id])

  useEffect(() => {
    if (hasWalletBs && !hasWalletUSD) setMonedaRecarga('bs');
    else if (!hasWalletBs && hasWalletUSD) setMonedaRecarga('usd');
    else if (isCliente) setMonedaRecarga('bs');
    else setMonedaRecarga('usd');
  }, [isCliente, hasWalletBs, hasWalletUSD])

  const handleFileUpload = async (e) => {
    let file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      file = await compressImage(file)
      const fileName = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(`receipts/${fileName}`, file, { cacheControl: '31536000', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('comprobantes')
        .getPublicUrl(`receipts/${fileName}`)
      
      setComprobanteUrl(publicUrl)
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error al subir comprobante: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitRecarga = async (e) => {
    e.preventDefault()
    if (!monto || !metodoId || !referencia) {
      setAlertModal({ type: 'warning', message: 'Por favor completa todos los campos.' })
      return
    }

    if (referencia.trim().length !== 6) {
      setAlertModal({ type: 'warning', message: 'La referencia debe contener exactamente los últimos 6 dígitos del comprobante.' })
      return
    }

    setIsProcessing(true)
    let referenciaRegistrada = false;
    try {
      // Validar referencia duplicada
      try {
        await verificarYRegistrarReferencia(referencia, monto, 'recarga')
        referenciaRegistrada = true;
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

      const { error } = await solicitarRecarga(Number(monto), metodoId, referencia, comprobanteUrl, monedaRecarga)
      if (error) throw error

      setAlertModal({ type: 'success', message: `Solicitud de recarga en ${monedaRecarga === 'bs' ? 'Bolívares' : 'Dólares'} enviada con éxito. Tu saldo se actualizará una vez sea verificado por administración.` })
      setMonto('')
      setReferencia('')
      setMetodoId('')
      setComprobanteUrl(null)
    } catch (err) {
      if (referenciaRegistrada && referencia) {
        try {
          await supabase.rpc('liberar_referencia_rpc', { p_referencia: referencia });
        } catch (releaseErr) {
          console.error("Error al liberar referencia:", releaseErr);
        }
      }
      setAlertModal({ type: 'error', message: 'Error al enviar solicitud: ' + err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProcesarRecarga = async (recargaId, status) => {
    try {
      if (status === 'aprobado') {
        const { data, error } = await supabase.rpc('aprobar_recarga_rpc', {
          p_recarga_id: recargaId,
          p_admin_id: perfil.id
        })
        if (error) throw error
        if (!data) throw new Error('No se pudo aprobar la recarga.')
      } else {
        const { error, data } = await supabase
          .from('billetera_recargas')
          .update({ estado: 'rechazado', atendido_por_id: user.id, updated_at: new Date().toISOString() })
          .eq('id', recargaId)
          .select()
          .single()
        if (error) throw error
        if (!data) throw new Error('No se pudo actualizar la recarga.')
      }

      setAlertModal({ type: 'success', message: `Recarga ${status} correctamente.` })
      fetchPendingRecargas()
      refetch()
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error al procesar: ' + err.message })
    }
  }

  const handleRevertirRecarga = (recarga) => {
    setAlertModal({
      type: 'confirm',
      title: '⚠️ Revertir Recarga',
      message: `¿Estás seguro de revertir la acreditación de ${formatUSD(recarga.monto)} a ${recarga.clientes?.nombres || 'este usuario'}? El saldo será deducido de su billetera.`,
      onConfirm: async () => {
        setAlertModal(null)
        try {
          const { data, error } = await supabase.rpc('revertir_recarga_rpc', {
            p_recarga_id: recarga.id,
            p_admin_id: perfil.id
          })
          if (error) throw error
          if (!data) throw new Error('No se pudo revertir la recarga.')
          setAlertModal({ type: 'success', message: 'Recarga revertida correctamente. El saldo fue deducido.' })
          fetchPendingRecargas()
          refetch()
        } catch (err) {
          setAlertModal({ type: 'error', message: 'Error al revertir: ' + err.message })
        }
      }
    })
  }

  if (loading) return <div className="page-content center-flex">Cargando billetera...</div>

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <div>
          <h1 className="page-title">Mi Billetera</h1>
          <p className="page-subtitle">Gestiona tu saldo digital y solicita recargas.</p>
        </div>
      </div>

      <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr' : '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* COLUMNA IZQUIERDA: RESUMEN Y SOLICITUDES ADMIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tarjetas de Saldo Dual */}
          <div className="kpi-grid" style={{ marginBottom: '8px' }}>
            {/* Saldo USD */}
            {hasWalletUSD && (
              <div className="card kpi-card" style={{ 
                background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(0, 210, 255, 0.05) 100%)',
                textAlign: 'center', border: '1px solid var(--accent-primary)',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(to right, #00d2ff, #3a7bd5)' }}></div>
                <div className="kpi-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  💵 Saldo USD
                </div>
                <div translate="no" className="kpi-value notranslate" style={{ fontWeight: 900, color: 'var(--accent-success)', textShadow: '0 0 20px rgba(34, 197, 94, 0.2)' }}>
                  {formatUSD(wallet?.saldo || 0)}
                </div>
              </div>
            )}

            {/* Saldo Bs */}
            {hasWalletBs && (
            <div className="card kpi-card" style={{ 
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.05) 100%)',
              textAlign: 'center', border: '1px solid rgba(139, 92, 246, 0.4)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(to right, #8b5cf6, #a855f7)' }}></div>
              <div className="kpi-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                🏦 Saldo Bolívares
              </div>
              <div translate="no" className="kpi-value notranslate" style={{ fontWeight: 900, color: '#a855f7', textShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}>
                {formatBs(wallet?.saldo_bs || 0)}
              </div>
            </div>
            )}
          </div>

          {/* Saldo de Ventas (Solo para Administradores) */}
          {isAdmin && (
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(0, 210, 255, 0.05) 100%)',
              border: '1px solid rgba(0, 210, 255, 0.2)',
              padding: '20px', marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>💰 Mi Saldo de Ventas (Acumulado)</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Monto bruto total de pedidos procesados por ti.</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={refetch}>🔄</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div translate="no" className="notranslate" style={{ padding: '12px', background: 'var(--bg-panel)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Pendiente USD</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-success)' }}>{formatUSD(adminSalesBalance.saldo_usd || 0)}</div>
                </div>
                <div translate="no" className="notranslate" style={{ padding: '12px', background: 'var(--bg-panel)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Pendiente Bs</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#a855f7' }}>{formatBs(adminSalesBalance.saldo_bs || 0)}</div>
                </div>
              </div>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ width: '100%', marginTop: '16px', height: '36px', fontSize: '12px' }}
                onClick={() => onNavigate('pagos_admins')}
              >
                Ver Detalle en Pagos Admins
              </button>
            </div>
          )}

          {/* Gestión Admin de Recargas */}
          {isAdmin && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Solicitudes de Recarga Pendientes</h3>
                <button className="btn btn-ghost btn-sm" onClick={fetchPendingRecargas}>🔄</button>
              </div>
              <div style={{ padding: '24px' }}>
                {loadingAdmin ? (
                  <p className="text-muted center-text">Buscando solicitudes...</p>
                ) : pendingRecargas.length === 0 ? (
                  <p className="text-muted center-text">No hay solicitudes pendientes.</p>
                ) : (
                  <div className="table-container">
                    <table className="table table-cards-mobile">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Monto</th>
                          <th>Método / Referencia</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRecargas.map(r => (
                          <tr key={r.id}>
                            <td data-label="Usuario">
                              <div>
                                <div style={{ fontWeight: 600 }}>{r.clientes?.nombres} {r.clientes?.apellidos}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{r.clientes?.nickname}</div>
                              </div>
                            </td>
                            <td data-label="Monto" translate="no" className="notranslate">
                              <span translate="no" className="notranslate" style={{ fontWeight: 700, color: r.moneda === 'bs' ? '#a855f7' : 'var(--accent-success)' }}>{r.moneda === 'bs' ? formatBs(r.monto) : formatUSD(r.monto)}</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.moneda === 'bs' ? 'Bolívares' : 'Dólares'}</div>
                            </td>
                            <td data-label="Método/Ref">
                              <div>
                                <div style={{ fontSize: '13px' }}>{r.metodos_pago?.nombre}</div>
                                <div style={{ fontSize: '11px', opacity: 0.7 }}>Ref: {r.referencia_pago}</div>
                                {r.comprobante_url && (
                                  <button 
                                    onClick={() => setSelectedComprobante(r.comprobante_url)}
                                    style={{ 
                                      fontSize: '11px', color: 'var(--accent-primary)', background: 'none', border: 'none', 
                                      padding: 0, textDecoration: 'underline', cursor: 'pointer', fontWeight: 600
                                    }}
                                  >
                                    Ver Comprobante
                                  </button>
                                )}
                              </div>
                            </td>
                            <td data-label="Acciones">
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleProcesarRecarga(r.id, 'aprobado')}>✅ Aprobar</button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-error)' }} onClick={() => handleProcesarRecarga(r.id, 'rechazado')}>❌ Rechazar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recargas Aprobadas - Reversión */}
          {isAdmin && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Recargas Aprobadas Recientes</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Últimas 20</span>
              </div>
              <div style={{ padding: '24px' }}>
                {approvedRecargas.length === 0 ? (
                  <p className="text-muted center-text">No hay recargas aprobadas recientes.</p>
                ) : (
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="table table-cards-mobile">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Monto</th>
                          <th>Método / Ref</th>
                          <th>Fecha</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedRecargas.map(r => (
                          <tr key={r.id}>
                            <td data-label="Usuario">
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.clientes?.nombres} {r.clientes?.apellidos}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@{r.clientes?.nickname}</div>
                              </div>
                            </td>
                            <td data-label="Monto" translate="no" className="notranslate">
                              <span translate="no" className="notranslate" style={{ fontWeight: 700, color: r.moneda === 'bs' ? '#a855f7' : 'var(--accent-success)' }}>{r.moneda === 'bs' ? formatBs(r.monto) : formatUSD(r.monto)}</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.moneda === 'bs' ? 'Bolívares' : 'Dólares'}</div>
                            </td>
                            <td data-label="Método/Ref">
                              <div>
                                <div style={{ fontSize: '12px' }}>{r.metodos_pago?.nombre}</div>
                                <div style={{ fontSize: '10px', opacity: 0.6 }}>Ref: {r.referencia_pago}</div>
                              </div>
                            </td>
                            <td data-label="Fecha" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {new Date(r.updated_at || r.created_at).toLocaleDateString()}
                            </td>
                            <td data-label="Acción">
                              <button 
                                className="btn btn-ghost btn-sm" 
                                style={{ color: 'var(--accent-error)', fontSize: '11px' }}
                                onClick={() => handleRevertirRecarga(r)}
                              >
                                ↩️ Revertir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recargas Rechazadas */}
          {isAdmin && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Recargas Rechazadas Recientes</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Últimas 20</span>
              </div>
              <div style={{ padding: '24px' }}>
                {rejectedRecargas.length === 0 ? (
                  <p className="text-muted center-text">No hay recargas rechazadas recientes.</p>
                ) : (
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="table table-cards-mobile">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Monto</th>
                          <th>Método / Ref</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rejectedRecargas.map(r => (
                          <tr key={r.id}>
                            <td data-label="Usuario">
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.clientes?.nombres} {r.clientes?.apellidos}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@{r.clientes?.nickname}</div>
                              </div>
                            </td>
                            <td data-label="Monto" translate="no" className="notranslate">
                              <span translate="no" className="notranslate" style={{ fontWeight: 700, color: r.moneda === 'bs' ? '#a855f7' : 'var(--accent-success)' }}>{r.moneda === 'bs' ? formatBs(r.monto) : formatUSD(r.monto)}</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.moneda === 'bs' ? 'Bolívares' : 'Dólares'}</div>
                            </td>
                            <td data-label="Método/Ref">
                              <div>
                                <div style={{ fontSize: '12px' }}>{r.metodos_pago?.nombre}</div>
                                <div style={{ fontSize: '10px', opacity: 0.6 }}>Ref: {r.referencia_pago}</div>
                              </div>
                            </td>
                            <td data-label="Fecha" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {new Date(r.updated_at || r.created_at).toLocaleDateString()}
                            </td>
                            <td data-label="Estado">
                              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                                ❌ Rechazado
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historial de Movimientos (Combinado: recargas + transacciones) */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Historial de Movimientos</h3>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {(() => {
                // Filtrar las transacciones de ajuste_admin para que solo los administradores puedan verlas
                const filteredTransacciones = transacciones.filter(t => isAdmin || t.tipo !== 'ajuste_admin')

                // Combinar transacciones aprobadas + recargas no aprobadas
                const combined = [
                  ...filteredTransacciones
                    .filter(t => !isCliente || t.moneda !== 'usd')
                    .map(t => ({
                      id: t.id, fecha: t.created_at, desc: t.descripcion,
                      monto: t.monto, tipo: t.tipo, estado: 'completado', moneda: t.moneda || 'usd',
                      referencia_id: t.referencia_id
                    })),
                  ...recargas
                    .filter(r => r.estado !== 'aprobado' && (!isCliente || r.moneda !== 'usd'))
                    .map(r => ({
                      id: r.id, fecha: r.created_at,
                      desc: `Solicitud de Recarga ${r.moneda === 'bs' ? '(Bs)' : '(USD)'} (${r.metodos_pago?.nombre || 'Pago'}) - Ref: ${r.referencia_pago}`,
                      monto: r.monto, tipo: 'recarga', estado: r.estado, moneda: r.moneda || 'usd'
                    }))
                ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

                if (combined.length === 0) {
                  return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Aún no tienes movimientos registrados.</div>
                }

                const estadoBadge = (estado) => {
                  const styles = {
                    pendiente: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: '🔄 Pendiente' },
                    rechazado: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: '❌ Rechazado' },
                    completado: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: '✅ Completado' },
                  }
                  const s = styles[estado] || styles.pendiente
                  return <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', backgroundColor: s.bg, color: s.color, fontWeight: 700 }}>{s.label}</span>
                }

                return (
                  <table className="table table-cards-mobile">
                    <thead><tr><th>Fecha</th><th>Descripción</th><th>Estado</th><th>Monto</th></tr></thead>
                    <tbody>
                      {combined.map(item => {
                        const isOrderRelated = (item.tipo === 'pago_pedido' || item.tipo === 'reembolso') && item.referencia_id;
                        return (
                          <tr 
                            key={item.id}
                            onClick={() => {
                              if (isOrderRelated) {
                                handleViewOrder(item.referencia_id)
                              }
                            }}
                            style={{ 
                              cursor: isOrderRelated ? 'pointer' : 'default',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => isOrderRelated && (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                            onMouseLeave={e => isOrderRelated && (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td data-label="Fecha" style={{ fontSize: '12px' }}>{new Date(item.fecha).toLocaleDateString()}</td>
                            <td data-label="Descripción">
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                                  {item.desc}
                                  {isOrderRelated && (
                                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                      👁️ Ver Pedido
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.tipo}</div>
                              </div>
                            </td>
                            <td data-label="Estado">{estadoBadge(item.estado)}</td>
                            <td data-label="Monto" translate="no" className="notranslate" style={{ fontWeight: 700, color: item.monto > 0 ? (item.moneda === 'bs' ? '#a855f7' : 'var(--accent-success)') : 'var(--accent-error)' }}>
                              {item.monto > 0 ? '+' : ''}
                              <span>{item.moneda === 'bs' ? formatBs(item.monto) : formatUSD(item.monto)}</span>
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>{item.moneda === 'bs' ? 'Bs' : 'USD'}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO DE RECARGA (Solo Cliente/Revendedor o Admin para su propia cuenta) */}
        {!isAdmin || true ? ( // Permitimos a todos recargar su propia billetera
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-header">
              <h3 className="card-title">Cargar Saldo</h3>
            </div>
            <form onSubmit={handleSubmitRecarga} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Selector de Moneda */}
              <div className="form-group">
                <label className="form-label">Moneda de Recarga</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {hasWalletUSD && (
                    <button
                      type="button"
                      onClick={() => setMonedaRecarga('usd')}
                      style={{
                        flex: 1, minWidth: '130px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                        backgroundColor: monedaRecarga === 'usd' ? 'rgba(0, 210, 255, 0.15)' : 'var(--bg-panel)',
                        border: `2px solid ${monedaRecarga === 'usd' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        color: monedaRecarga === 'usd' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease'
                      }}
                    >
                      💵 Dólares (USD)
                    </button>
                  )}
                  {hasWalletBs && (
                  <button
                    type="button"
                    onClick={() => setMonedaRecarga('bs')}
                    style={{
                      flex: 1, minWidth: '130px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      backgroundColor: monedaRecarga === 'bs' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-panel)',
                      border: `2px solid ${monedaRecarga === 'bs' ? '#8b5cf6' : 'var(--border-color)'}`,
                      color: monedaRecarga === 'bs' ? '#a855f7' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease'
                    }}
                  >
                    🏦 Bolívares (Bs)
                  </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Monto a Recargar ({monedaRecarga === 'bs' ? 'Bs' : 'USD'})</label>
                {monedaRecarga === 'bs' && montosBsFijos.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                      {montosBsFijos.map((m, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMonto(m)}
                          className={`btn ${monto === m ? 'btn-primary' : 'btn-ghost'}`}
                          style={{
                            height: 'auto', padding: '12px 8px',
                            border: monto === m ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: monto === m ? 'var(--accent-primary)' : 'var(--bg-panel)',
                            color: monto === m ? '#fff' : 'var(--text-muted)',
                            fontWeight: monto === m ? 'bold' : 'normal',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span translate="no" className="notranslate">{formatBs(m)}</span>
                        </button>
                      ))}
                    </div>
                    {monto && (
                      <div className="fade-in" style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(251, 191, 36, 0.1)', borderLeft: '4px solid #fbbf24', borderRadius: '6px' }}>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#fbbf24', lineHeight: 1.4 }}>
                          ⚠️ <strong>Recuerda:</strong> Debes pagar exactamente el monto seleccionado para poder validar el pago.
                        </p>
                      </div>
                    )}
                  </>
                ) : monedaRecarga === 'usd' && montosUsdFijos.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                      {montosUsdFijos.map((m, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMonto(m)}
                          className={`btn ${monto === m ? 'btn-primary' : 'btn-ghost'}`}
                          style={{
                            height: 'auto', padding: '12px 8px',
                            border: monto === m ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: monto === m ? 'var(--accent-primary)' : 'var(--bg-panel)',
                            color: monto === m ? '#fff' : 'var(--text-primary)',
                            fontWeight: 700, fontSize: '15px', borderRadius: '12px'
                          }}
                        >
                          ${m}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="1"
                      className="form-input" 
                      placeholder={monedaRecarga === 'bs' ? '0,00 Bs' : '$0.00'}
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      style={{ marginBottom: monedaRecarga === 'bs' && monto ? '8px' : '0' }}
                      required
                    />
                    {monedaRecarga === 'bs' && monto && (
                      <div className="fade-in" translate="no" style={{ 
                        fontSize: '18px', fontWeight: 800, color: '#a855f7', 
                        padding: '12px', backgroundColor: 'rgba(168, 85, 247, 0.1)', 
                        borderRadius: '10px', border: '1px dashed rgba(168, 85, 247, 0.3)',
                        textAlign: 'center'
                      }}>
                        💰 <span className="notranslate">{formatBs(monto)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Seleccionar Método de Pago</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                  {metodos.filter(m => m.activo && (monedaRecarga === 'bs' ? m.habilitado_billetera_bs : m.habilitado_billetera)).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoId(m.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                        padding: '14px 8px', borderRadius: '14px',
                        backgroundColor: metodoId === m.id ? 'rgba(0, 210, 255, 0.1)' : 'var(--bg-panel)',
                        border: `2px solid ${metodoId === m.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        cursor: 'pointer', transition: 'all 0.2s ease', color: 'inherit',
                        boxShadow: metodoId === m.id ? '0 0 12px rgba(0, 210, 255, 0.15)' : 'none'
                      }}
                    >
                      <div style={{
                        width: '56px', height: '56px', borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                      }}>
                        {m.icono_url ? (
                          <img loading="lazy" decoding="async" src={getOptimizedImageUrl(m.icono_url, 150)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '18px' }}>
                            {m.nombre.toLowerCase().includes('zelle') ? '🟣' :
                             m.nombre.toLowerCase().includes('pago') ? '📱' :
                             m.nombre.toLowerCase().includes('binance') ? '🟡' : '💳'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{m.nombre}</span>
                    </button>
                  ))}
                </div>
                {metodos.filter(m => m.activo && (monedaRecarga === 'bs' ? m.habilitado_billetera_bs : m.habilitado_billetera)).length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>No hay métodos habilitados para billetera.</p>
                )}
              </div>

              {metodoId && (() => {
                const selected = metodos.find(m => m.id === metodoId)
                if (!selected) return null
                return (
                  <div style={{ 
                    padding: '20px', borderRadius: '16px', 
                    background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.06) 0%, rgba(34, 197, 94, 0.04) 100%)',
                    border: '1px solid rgba(0, 210, 255, 0.2)',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    {/* Encabezado con ícono y nombre */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{
                        width: '52px', height: '52px', borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                      }}>
                        {selected.icono_url ? (
                          <img loading="lazy" decoding="async" src={getOptimizedImageUrl(selected.icono_url, 150)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '16px' }}>💳</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Pagar con {selected.nombre}</div>
                        <div style={{ fontSize: '10px', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Datos para la transferencia</div>
                      </div>
                    </div>
                    {/* Botón Copiar Todo */}
                    {selected.datos && (
                      <button 
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', marginBottom: '16px', border: '1px dashed var(--accent-primary)', borderRadius: '12px', color: 'var(--accent-primary)', fontWeight: 700, padding: '12px' }}
                        onClick={(e) => {
                          navigator.clipboard.writeText(selected.datos);
                          const btn = e.currentTarget;
                          const originalText = btn.innerHTML;
                          btn.innerHTML = '✅ ¡Datos de Pago Copiados!';
                          setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                        }}
                      >
                        📋 Copiar Todos los Datos
                      </button>
                    )}

                    {/* Datos del pago divididos por línea con copiado individual */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selected.datos.split('\n').filter(l => l.trim()).map((line, i) => {
                        const [label, ...valParts] = line.split(':');
                        const value = valParts.join(':').trim();

                        return (
                          <div key={i} style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            padding: '12px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '14px', 
                            border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            gap: '12px'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              {label && value ? (
                                <>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{label.trim()}</span>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
                                </>
                              ) : (
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{line}</span>
                              )}
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(value || line);
                              }} 
                              style={{ 
                                padding: '10px', borderRadius: '12px', background: 'rgba(0, 210, 255, 0.1)', 
                                border: '1px solid rgba(0, 210, 255, 0.2)', color: 'var(--accent-primary)', 
                                cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >📋</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              })()}


              <div className="form-group">
                <label className="form-label">Número de Referencia <span style={{ fontSize: '10px', opacity: 0.7 }}>(Últimos 6 dígitos)</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Escribe los 6 últimos dígitos aquí..."
                  value={referencia}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setReferencia(val);
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
                    setReferencia(pasteData);
                  }}
                  style={{ letterSpacing: '2px', fontSize: '16px', fontWeight: 600 }}
                  required
                />
                <div style={{ fontSize: '11px', color: 'var(--accent-warning)', marginTop: '6px', fontWeight: 600 }}>
                  ⚠️ Recuerda que debes colocar exactamente los 6 últimos números de la referencia del pago.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Comprobante de Pago (Opcional)</label>
                <div style={{ 
                  border: '2px dashed var(--border-color)', borderRadius: '12px', 
                  padding: '20px', textAlign: 'center', cursor: 'pointer',
                  position: 'relative'
                }}>
                  {comprobanteUrl ? (
                    <img loading="lazy" decoding="async" src={getOptimizedImageUrl(comprobanteUrl, 400)} alt="Comprobante" style={{ maxHeight: '100px', margin: '0 auto' }} />
                  ) : (
                    <>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📤</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Haz clic para subir imagen</div>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    disabled={uploading}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isProcessing || uploading || (referencia.trim().length !== 6)}
                style={{ height: '48px', marginTop: '8px' }}
              >
                {isProcessing ? 'Enviando...' : 'Solicitar Recarga'}
              </button>
            </form>
          </div>
        ) : null}

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
      {/* Modal para ver comprobante de pago */}
      {selectedComprobante && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 3000, padding: '20px', animation: 'fadeIn 0.3s ease'
          }}
          onClick={() => setSelectedComprobante(null)}
        >
          <div 
            style={{ 
              position: 'relative', maxWidth: '100%', maxHeight: '100%', 
              display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedComprobante(null)}
              style={{
                position: 'absolute', top: '-15px', right: '-15px', width: '40px', height: '40px',
                borderRadius: '50%', border: 'none', backgroundColor: '#ef4444', color: 'white',
                fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
              }}
            >
              ×
            </button>
            <img loading="lazy" decoding="async" src={selectedComprobante} 
              alt="Comprobante de pago" 
              style={{ 
                maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                objectFit: 'contain'
              }} 
            />
            <div style={{ marginTop: '20px' }}>
              <a 
                href={selectedComprobante} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  padding: '10px 24px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.2)', transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              >
                Abrir en nueva pestaña ↗
              </a>
            </div>
          </div>
        </div>
      )}

        {/* Modal: Detalle de Pedido */}
        {selectedOrder && (
          <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
            <div className="modal-content" style={{ 
              maxWidth: '650px', backgroundColor: 'var(--bg-card)', borderRadius: '28px', 
              overflow: 'hidden', border: '1px solid var(--border-color)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              animation: 'modalSlideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ 
                padding: '24px', 
                background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(58, 123, 213, 0.1) 100%)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Pedido #{selectedOrder.numero_pedido}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ 
                    padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    backgroundColor: selectedOrder.estado === 'completado' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: selectedOrder.estado === 'completado' ? '#22c55e' : '#f59e0b'
                   }}>
                    {selectedOrder.estado}
                  </span>
                  <button onClick={() => setSelectedOrder(null)} style={{ background: 'var(--bg-panel)', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
              
              <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Paquetes Adquiridos</h4>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedOrder.pedido_items?.map((item, idx) => (
                    <div key={idx} style={{ 
                      padding: '16px', backgroundColor: 'var(--bg-panel)', borderRadius: '18px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '16px', color: 'white' }}>{item.producto_nombre}</span>
                        <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>{formatBs(item.precio_bs)}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        🎮 {item.juego_nombre} · Cantidad: {item.cantidad}
                      </div>
                      
                      {/* Información de Recarga */}
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(0, 210, 255, 0.05)', borderRadius: '12px', fontSize: '14px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                        {item.metodo_recarga === 'solo_correo' ? (
                          <>📧 Correo: {item.account_email}</>
                        ) : item.metodo_recarga === 'solo_usuario' ? (
                          <>👤 Usuario: {item.account_user || item.account_email}</>
                        ) : item.metodo_recarga === 'id_jugador' ? (
                          <>🆔 ID del Jugador: {item.player_id}</>
                        ) : item.metodo_recarga === 'id_zone' ? (
                          <>🆔 ID: {item.player_id} | 🌐 ZONE ID: {item.zone_id}</>
                        ) : item.metodo_recarga === 'cuenta_completa' ? (
                          <>📧 {item.account_email} | 🔑 {item.account_password}</>
                        ) : item.metodo_recarga === 'cuenta_nueva' ? (
                          <>✨ Cuenta Nueva (Nosotros la proporcionamos)</>
                        ) : (
                          <>
                            👤 {item.account_user || item.account_email} <br/>
                            🔑 {item.account_password}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Monto Total (Bs):</span>
                    <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--accent-success)' }}>{formatBs(selectedOrder.total_bs)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Monto Total (USD):</span>
                    <span style={{ fontWeight: 600 }}>{formatUSD(selectedOrder.total_usd)}</span>
                  </div>
                </div>

                {selectedOrder.referencia_pago && (
                  <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-panel)', borderRadius: '14px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Referencia de Pago: </span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{selectedOrder.referencia_pago}</span>
                  </div>
                )}
              </div>
              
              <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedOrder(null)}
                  style={{ borderRadius: '12px', padding: '10px 24px' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {loadingOrder && (
          <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div className="spinner" style={{ marginBottom: '10px' }}></div>
              <p>Consultando pedido...</p>
            </div>
          </div>
        )}
      </div>
  )
}

