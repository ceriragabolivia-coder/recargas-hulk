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
          <div className="table-wrapper">
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
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.notas}</td>
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
