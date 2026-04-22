import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import { formatUSD, formatBs } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function PagosAdmins() {
  const { user, perfil } = useAuth()
  const [saldos, setSaldos] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  
  const [montoLiquidar, setMontoLiquidar] = useState('')
  const [monedaLiquidar, setMonedaLiquidar] = useState('usd')
  const [referenciaLiquidar, setReferenciaLiquidar] = useState('')
  const [adminSelected, setAdminSelected] = useState(null)
  const [showLiquidarModal, setShowLiquidarModal] = useState(false)

  // Estados para Detalle de Pedido
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null)
  const [orderDetail, setOrderDetail] = useState(null)
  const [loadingOrder, setLoadingOrder] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Obtener saldos de admins + sus perfiles/nombres
      const { data: saldosData, error: sError } = await supabase
        .from('admin_saldos')
        .select(`
          auth_user_id,
          saldo_usd,
          saldo_bs,
          updated_at
        `)

      if (sError) throw sError

      // 2. Obtener perfiles de los admins para tener los nombres
      const adminIds = saldosData.map(s => s.auth_user_id)
      
      // Si hay admins en saldos, buscamos sus nombres
      let perfilesMap = new Map()
      if (adminIds.length > 0) {
        const { data: pData } = await supabase
          .from('clientes')
          .select('auth_user_id, nombres, apellidos, nickname, usuario')
          .in('auth_user_id', adminIds)
        
        if (pData) {
          pData.forEach(p => perfilesMap.set(p.auth_user_id, p))
        }
      }

      const finalSaldos = saldosData.map(s => ({
        ...s,
        perfil: perfilesMap.get(s.auth_user_id) || { nombres: 'Admin', apellidos: 'Desconocido' }
      }))

      setSaldos(finalSaldos)

      // 3. Obtener historial (unido con nombres de liquidador y admin)
      const { data: histData, error: hError } = await supabase
        .from('admin_saldos_historial')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (hError) throw hError
      
      // Para el historial también necesitamos nombres
      // Buscamos IDs de admins involucrados en el historial (admin_id y liquidado_por_id)
      const histUserIds = [...new Set([
        ...histData.map(h => h.admin_id),
        ...histData.map(h => h.liquidado_por_id).filter(Boolean)
      ])]

      if (histUserIds.length > 0) {
        const { data: pHData } = await supabase
          .from('clientes')
          .select('auth_user_id, nombres, usuario')
          .in('auth_user_id', histUserIds)
        
        const hPerprofilesMap = new Map()
        if (pHData) pHData.forEach(p => hPerprofilesMap.set(p.auth_user_id, p))
        
        setHistorial(histData.map(h => ({
          ...h,
          admin_nombre: hPerprofilesMap.get(h.admin_id)?.nombres || 'Admin',
          liquidador_nombre: h.liquidado_por_id ? (hPerprofilesMap.get(h.liquidado_por_id)?.nombres || 'Admin') : null
        })))
      } else {
        setHistorial([])
      }

    } catch (err) {
      console.error("Error fetching admin payments data:", err)
      showAlert("Error al cargar datos de pagos: " + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenLiquidar = (admin, moneda) => {
    setAdminSelected(admin)
    setMonedaLiquidar(moneda)
    setMontoLiquidar(moneda === 'usd' ? admin.saldo_usd : admin.saldo_bs)
    setReferenciaLiquidar('')
    setShowLiquidarModal(true)
  }

  const handleOpenOrderDetail = async (orderNumber, pedidoId) => {
    setSelectedOrderNumber(orderNumber)
    setLoadingOrder(true)
    setOrderDetail(null)
    
    try {
      let query = supabase
        .from('pedidos')
        .select('*, pedido_items(*)');

      // 1. Priorizar búsqueda por UUID si lo tenemos
      if (pedidoId) {
        query = query.eq('id', pedidoId);
      } else {
        // Backup: Buscar por número de pedido (probamos con número e intentamos ser flexibles)
        const cleanNum = orderNumber.toString().replace('#', '').trim();
        query = query.or(`numero_pedido.eq.${parseInt(cleanNum)},numero_pedido.eq.${cleanNum}`);
      }

      const { data: ped, error: pError } = await query.maybeSingle();
      
      if (pError) throw pError;
      if (!ped) {
        // Último intento: Si no se encontró, tal vez el número de pedido es un string exacto
        const { data: pedRetry } = await supabase
          .from('pedidos')
          .select('*, pedido_items(*)')
          .eq('numero_pedido', orderNumber.toString().trim())
          .maybeSingle();
        
        if (!pedRetry) {
          showAlert("No se encontró el pedido #" + orderNumber, "error");
          setSelectedOrderNumber(null);
          return;
        }
        setOrderDetail(pedRetry);
      } else {
        // Encontramos el pedido, ahora el cliente
        const { data: cli } = await supabase
          .from('clientes')
          .select('*')
          .or(`id.eq.${ped.cliente_id},auth_user_id.eq.${ped.cliente_id}`)
          .maybeSingle()

        setOrderDetail({ ...ped, cliente: cli })
      }
    } catch (err) {
      console.error("Error fetching order detail:", err)
      showAlert("No se pudo cargar el detalle del pedido #" + orderNumber, "error")
      setSelectedOrderNumber(null)
    } finally {
      setLoadingOrder(false)
    }
  }

  const renderDetallesLink = (notas, pedidoId) => {
    if (!notas) return '-';
    // Buscar patrón tipo "Pedido #000253" o "#000253"
    const regex = /(Pedido\s*#)(\d+)/gi;
    const parts = notas.split(regex);
    
    if (parts.length === 1) return notas;

    const result = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex
    const myRegex = /(Pedido\s*#)(\d+)/gi;

    while ((match = myRegex.exec(notas)) !== null) {
      // Texto antes del match
      result.push(notas.substring(lastIndex, match.index));
      
      const prefix = match[1];
      const orderNum = match[2];
      
      result.push(
        <span key={match.index}>
          {prefix}
          <span 
            style={{ 
              color: 'var(--accent-primary)', 
              fontWeight: 800, 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            onClick={() => handleOpenOrderDetail(orderNum, pedidoId)}
          >
            {orderNum}
          </span>
        </span>
      );
      
      lastIndex = myRegex.lastIndex;
    }
    
    result.push(notas.substring(lastIndex));
    return result;
  };

  const handleLiquidar = async () => {
    if (!montoLiquidar || isNaN(montoLiquidar) || Number(montoLiquidar) <= 0) {
      showAlert("Ingresa un monto válido.", "error")
      return
    }

    setIsProcessing(true)
    try {
      const { data, error } = await supabase.rpc('liquidar_saldo_admin_rpc', {
        p_admin_id: adminSelected.auth_user_id,
        p_liquidador_id: user.id,
        p_moneda: monedaLiquidar,
        p_monto: Number(montoLiquidar),
        p_referencia: referenciaLiquidar,
        p_notas: `Liquidación manual de saldo en ${monedaLiquidar.toUpperCase()} por administración.`
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      showAlert(`✅ Liquidación de ${monedaLiquidar === 'usd' ? formatUSD(montoLiquidar) : formatBs(montoLiquidar)} procesada correctamente.`, 'success')
      setShowLiquidarModal(false)
      fetchData()
    } catch (err) {
      showAlert("Error en liquidación: " + err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const showAlert = (message, type = 'info') => {
    setAlertModal({ message, type })
  }

  const getTipoLabel = (tipo) => {
    switch (tipo) {
      case 'credito_venta': return { label: 'Crédito Venta', color: '#22c55e', icon: '💰' }
      case 'reverso_venta': return { label: 'Reverso Venta', color: '#ff5252', icon: '🔄' }
      case 'liquidacion': return { label: 'Liquidado (Pago)', color: '#00d2ff', icon: '💸' }
      default: return { label: tipo, color: 'var(--text-muted)', icon: '📝' }
    }
  }

  if (loading) return <div className="page-content center-flex"><div className="spinner"></div><p>Cargando información de pagos...</p></div>

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <div>
          <h1 className="page-title">Pagos a Administradores</h1>
          <p className="page-subtitle">Gestiona y liquida el saldo acumulado por cada operario según sus ventas procesadas.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchData}>🔄 Refrescar Datos</button>
      </div>

      <div className="card mb-24" style={{ 
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(0, 210, 255, 0.05) 100%)',
        border: '1px solid var(--border-color)',
        padding: '24px'
      }}>
        <h3 className="card-title mb-16" style={{ fontSize: '18px' }}>Saldos por Administrador (Bruto Acumulado)</h3>
        {saldos.length === 0 ? (
          <p className="text-muted center-text">No hay administradores con saldo registrado actualmente.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Administrador</th>
                  <th>Saldo USD Acumulado</th>
                  <th>Saldo Bs Acumulado</th>
                  <th>Última Actividad</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map(s => (
                  <tr key={s.auth_user_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', 
                          background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
                        }}>
                          👤
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{s.perfil.nombres} {s.perfil.apellidos}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{s.perfil.usuario || 'admin'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '16px' }}>{formatUSD(s.saldo_usd)}</td>
                    <td style={{ fontWeight: 800, color: '#a855f7', fontSize: '16px' }}>{formatBs(s.saldo_bs)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(s.updated_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-sm" 
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                          onClick={() => handleOpenLiquidar(s, 'usd')}
                          disabled={s.saldo_usd <= 0}
                        >
                          💸 Liquidar USD
                        </button>
                        <button 
                          className="btn btn-sm" 
                          style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                          onClick={() => handleOpenLiquidar(s, 'bs')}
                          disabled={s.saldo_bs <= 0}
                        >
                          🏦 Liquidar Bs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Historial de Movimientos y Liquidaciones</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Operario</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Referencia</th>
                <th>Detalles</th>
                <th>Responsable Pago</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay movimientos registrados.</td></tr>
              ) : (
                historial.map(h => {
                  const info = getTipoLabel(h.tipo_movimiento)
                  return (
                    <tr key={h.id}>
                      <td style={{ fontSize: '12px' }}>{new Date(h.created_at).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{h.admin_nombre}</td>
                      <td>
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '4px 10px', borderRadius: '12px', 
                          fontSize: '11px', fontWeight: 700,
                          backgroundColor: `${info.color}15`, color: info.color
                        }}>
                          {info.icon} {info.label}
                        </span>
                      </td>
                      <td style={{ 
                        fontWeight: 700, 
                        color: h.tipo_movimiento === 'liquidacion' || h.tipo_movimiento === 'reverso_venta' ? 'var(--accent-error)' : 'var(--accent-success)'
                      }}>
                        {h.tipo_movimiento === 'liquidacion' || h.tipo_movimiento === 'reverso_venta' ? '-' : '+'}
                        {h.moneda === 'usd' ? formatUSD(h.monto) : formatBs(h.monto)}
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {h.referencia || '-'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {renderDetallesLink(h.notas, h.pedido_id)}
                      </td>
                      <td>
                        {h.liquidador_nombre ? (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            ✅ {h.liquidador_nombre}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Liquidación */}
      {showLiquidarModal && (
        <div className="modal-overlay" onClick={() => setShowLiquidarModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💸</div>
              <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Liquidar Saldo a Operario</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Estás por marcar como <strong>Pagado</strong> el saldo de <strong>{adminSelected?.perfil?.nombres}</strong>.
              </p>
            </div>

            <div className="form-group mb-24">
              <label className="form-label">Monto a Liquidar ({monedaLiquidar.toUpperCase()})</label>
              <input 
                type="number" 
                className="form-input" 
                value={montoLiquidar} 
                onChange={e => setMontoLiquidar(e.target.value)}
                autoFocus
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                El saldo actual del administrador quedará en <strong>{monedaLiquidar === 'usd' ? formatUSD(adminSelected.saldo_usd - montoLiquidar) : formatBs(adminSelected.saldo_bs - montoLiquidar)}</strong>.
              </p>
            </div>

            <div className="form-group mb-24">
              <label className="form-label">Número de Referencia de Pago</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej: Pago móvil 1234..."
                value={referenciaLiquidar} 
                onChange={e => setReferenciaLiquidar(e.target.value)}
                required
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Ingresa el comprobante o referencia del pago real que le hiciste al operario.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleLiquidar} 
                style={{ flex: 1 }}
                disabled={isProcessing}
              >
                {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowLiquidarModal(false)}
                disabled={isProcessing}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Pedido */}
      {selectedOrderNumber && (
        <div className="modal-overlay" onClick={() => setSelectedOrderNumber(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ 
              backgroundColor: 'var(--bg-panel)', 
              padding: '24px', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '20px', margin: 0 }}>Detalle de Pedido #{selectedOrderNumber}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Información completa de la orden administrativa</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelectedOrderNumber(null)} style={{ fontSize: '20px', padding: '8px' }}>✕</button>
            </div>

            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {loadingOrder ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                  <p>Cargando información del pedido...</p>
                </div>
              ) : orderDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Fila 1: Cliente y Estado */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Cliente</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{orderDetail.cliente?.nombres || 'Cliente Desconocido'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>@{orderDetail.cliente?.usuario || 'user'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Estado General</label>
                      <div style={{ 
                        display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800,
                        backgroundColor: orderDetail.estado === 'completado' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 171, 0, 0.15)',
                        color: orderDetail.estado === 'completado' ? '#22c55e' : '#ffab00'
                      }}>
                        {orderDetail.estado === 'completado' ? '✅ COMPLETADO' : '⏳ ' + orderDetail.estado.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>{new Date(orderDetail.created_at).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Fila 2: Pagos y Referencia */}
                  <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Total Abonado</label>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-success)' }}>{formatBs(orderDetail.total_bs)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatUSD(orderDetail.total_usd)}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Referencia de Pago</label>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>{orderDetail.referencia_pago || 'S/R'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{orderDetail.pago_verificado ? '✅ Verificado por Admin' : '⏳ Pendiente'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Paquetes */}
                  <div>
                    <h3 style={{ fontSize: '14px', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Paquetes de la Orden</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {orderDetail.pedido_items?.map((item, idx) => (
                        <div key={idx} className="card" style={{ padding: '12px', borderLeft: '4px solid var(--accent-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '14px' }}>{item.producto_nombre}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.juego_nombre} (x{item.cantidad})</div>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatBs(item.precio_bs)}</div>
                          </div>
                          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>ID Jugador: </span>
                            <span style={{ fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '1px' }}>{item.player_id || item.account_email || item.account_user || 'N/A'}</span>
                          </div>
                          {item.referencia_admin && (
                            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              📌 Ref. Recarga: {item.referencia_admin}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {orderDetail.observaciones && (
                     <div style={{ padding: '12px', backgroundColor: 'rgba(255, 171, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 171, 0, 0.2)' }}>
                        <div style={{ fontSize: '10px', color: '#ffab00', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Notas Administrativas</div>
                        <p style={{ fontSize: '13px', margin: 0, whiteSpace: 'pre-line' }}>{orderDetail.observaciones}</p>
                     </div>
                  )}

                </div>
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No se pudo cargar la información.</p>
              )}
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.1)', textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={() => setSelectedOrderNumber(null)}>Cerrar Detalle</button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          message={alertModal.message}
          onConfirm={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
