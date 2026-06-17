import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useClientes } from '../hooks/useData'
import { formatUSD, formatBs, getLocalDateString } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function GestionSocios() {
  const { clientes, loading: loadingClientes } = useClientes()
  const socios = clientes.filter(c => c.rol === 'socio')

  const [activeTab, setActiveTab] = useState('capital') // 'capital' | 'distribuir' | 'pagos'
  const [capitalMap, setCapitalMap] = useState({})
  const [utilidadMap, setUtilidadMap] = useState({})
  const [capitalHistorial, setCapitalHistorial] = useState([])
  const [utilidadHistorial, setUtilidadHistorial] = useState([])
  const [distribuciones, setDistribuciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [alertModal, setAlertModal] = useState(null)

  const [showCapitalModal, setShowCapitalModal] = useState(false)
  const [capitalModalTipo, setCapitalModalTipo] = useState('aporte')
  const [socioSeleccionado, setSocioSeleccionado] = useState(null)
  const [montoCapital, setMontoCapital] = useState('')
  const [notasCapital, setNotasCapital] = useState('')

  const today = new Date()
  const [fechaDesde, setFechaDesde] = useState(getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [fechaHasta, setFechaHasta] = useState(getLocalDateString(today))
  const [preview, setPreview] = useState(null)
  const [calculando, setCalculando] = useState(false)
  const [showConfirmDistribucion, setShowConfirmDistribucion] = useState(false)

  const [showPagoModal, setShowPagoModal] = useState(false)
  const [montoPago, setMontoPago] = useState('')
  const [notasPago, setNotasPago] = useState('')

  const showAlert = (message, type = 'info') => setAlertModal({ message, type })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [capRes, utilRes, capHistRes, utilHistRes, distRes] = await Promise.all([
        supabase.from('socios_capital').select('*'),
        supabase.from('socios_utilidad').select('*'),
        supabase.from('socios_capital_historial').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('socios_utilidad_historial').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('distribuciones_utilidad').select('*').order('created_at', { ascending: false }).limit(20)
      ])

      const cMap = {}
      ;(capRes.data || []).forEach(r => { cMap[r.auth_user_id] = r.capital_aportado_usd })
      const uMap = {}
      ;(utilRes.data || []).forEach(r => { uMap[r.auth_user_id] = r.saldo_utilidad_bs })

      setCapitalMap(cMap)
      setUtilidadMap(uMap)
      setCapitalHistorial(capHistRes.data || [])
      setUtilidadHistorial(utilHistRes.data || [])
      setDistribuciones(distRes.data || [])
    } catch (err) {
      showAlert('Error al cargar datos de socios: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const nombreSocio = (id) => {
    const s = clientes.find(c => c.auth_user_id === id)
    if (!s) return 'Socio desconocido'
    return `${s.nombres || ''} ${s.apellidos || ''}`.trim() || s.nickname || s.usuario || 'Socio'
  }

  const capitalTotal = Object.values(capitalMap).reduce((a, b) => a + Number(b || 0), 0)

  const openCapitalModal = (socio, tipo) => {
    setSocioSeleccionado(socio)
    setCapitalModalTipo(tipo)
    setMontoCapital('')
    setNotasCapital('')
    setShowCapitalModal(true)
  }

  const handleRegistrarCapital = async () => {
    if (!montoCapital || isNaN(montoCapital) || Number(montoCapital) <= 0) {
      showAlert('Ingresa un monto válido.', 'error')
      return
    }
    setIsProcessing(true)
    try {
      const rpcName = capitalModalTipo === 'aporte' ? 'registrar_aporte_capital_rpc' : 'registrar_retiro_capital_rpc'
      const { data, error } = await supabase.rpc(rpcName, {
        p_socio_id: socioSeleccionado.auth_user_id,
        p_monto_usd: Number(montoCapital),
        p_notas: notasCapital || null
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'No se pudo registrar el movimiento')

      showAlert(`✅ ${capitalModalTipo === 'aporte' ? 'Aporte' : 'Retiro'} de capital registrado correctamente.`, 'success')
      setShowCapitalModal(false)
      fetchData()
    } catch (err) {
      showAlert('Error: ' + err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCalcular = async () => {
    setCalculando(true)
    setPreview(null)
    try {
      const { data, error } = await supabase.rpc('calcular_distribucion_utilidad_rpc', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })
      if (error) throw error
      if (!data?.success) {
        showAlert(data?.error || 'No se pudo calcular la distribución', 'warning')
        return
      }
      setPreview(data)
    } catch (err) {
      showAlert('Error: ' + err.message, 'error')
    } finally {
      setCalculando(false)
    }
  }

  const handleEjecutarDistribucion = async () => {
    setIsProcessing(true)
    try {
      const { data, error } = await supabase.rpc('ejecutar_distribucion_utilidad_rpc', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'No se pudo ejecutar la distribución')

      showAlert('✅ Distribución de utilidad ejecutada correctamente.', 'success')
      setShowConfirmDistribucion(false)
      setPreview(null)
      fetchData()
    } catch (err) {
      showAlert('Error: ' + err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const openPagoModal = (socio) => {
    setSocioSeleccionado(socio)
    setMontoPago(String(utilidadMap[socio.auth_user_id] || 0))
    setNotasPago('')
    setShowPagoModal(true)
  }

  const handlePagarUtilidad = async () => {
    if (!montoPago || isNaN(montoPago) || Number(montoPago) <= 0) {
      showAlert('Ingresa un monto válido.', 'error')
      return
    }
    setIsProcessing(true)
    try {
      const { data, error } = await supabase.rpc('pagar_utilidad_socio_rpc', {
        p_socio_id: socioSeleccionado.auth_user_id,
        p_monto_bs: Number(montoPago),
        p_notas: notasPago || 'Pago de utilidad a socio'
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'No se pudo registrar el pago')

      showAlert('✅ Pago de utilidad registrado correctamente.', 'success')
      setShowPagoModal(false)
      fetchData()
    } catch (err) {
      showAlert('Error: ' + err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading || loadingClientes) {
    return <div className="page-content center-flex"><div className="spinner"></div><p>Cargando información de socios...</p></div>
  }

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <div>
          <h1 className="page-title">Socios y Distribución de Utilidades</h1>
          <p className="page-subtitle">Gestiona el capital aportado por cada socio y reparte la utilidad generada proporcionalmente.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchData}>🔄 Refrescar Datos</button>
      </div>

      <div className="tabs mb-24" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
        {[
          { key: 'capital', label: '💰 Socios y Capital' },
          { key: 'distribuir', label: '📊 Distribuir Utilidad' },
          { key: 'pagos', label: '💸 Pagos de Utilidad' }
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            style={{
              padding: '12px 24px', backgroundColor: 'transparent', border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === t.key ? 'bold' : 'normal', cursor: 'pointer', fontSize: '15px'
            }}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'capital' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Capital Aportado por Socio</h3>
            <div translate="no" className="notranslate" style={{ fontWeight: 800, color: 'var(--accent-success)' }}>
              Total: {formatUSD(capitalTotal)}
            </div>
          </div>
          {socios.length === 0 ? (
            <p className="text-muted center-text" style={{ padding: '24px' }}>
              No hay usuarios con rol "Socio" todavía. Asígnalo desde la pantalla de Usuarios.
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>Capital Aportado (USD)</th>
                    <th>% Participación</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {socios.map(s => {
                    const capital = Number(capitalMap[s.auth_user_id] || 0)
                    const pct = capitalTotal > 0 ? (capital / capitalTotal) * 100 : 0
                    return (
                      <tr key={s.auth_user_id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{s.nombres} {s.apellidos}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{s.usuario || s.nickname}</div>
                        </td>
                        <td translate="no" className="notranslate" style={{ fontWeight: 800, color: 'var(--accent-success)' }}>{formatUSD(capital)}</td>
                        <td style={{ fontWeight: 700 }}>{pct.toFixed(2)}%</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-sm"
                              style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                              onClick={() => openCapitalModal(s, 'aporte')}
                            >
                              ➕ Aportar
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                              onClick={() => openCapitalModal(s, 'retiro')}
                              disabled={capital <= 0}
                            >
                              ➖ Retirar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="card-header" style={{ marginTop: '24px' }}>
            <h3 className="card-title">Historial de Movimientos de Capital</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Monto</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {capitalHistorial.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Sin movimientos registrados.</td></tr>
                ) : capitalHistorial.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: '12px' }}>{new Date(h.created_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{nombreSocio(h.socio_id)}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: h.tipo_movimiento === 'aporte_capital' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: h.tipo_movimiento === 'aporte_capital' ? '#22c55e' : '#ef4444'
                      }}>
                        {h.tipo_movimiento === 'aporte_capital' ? '➕ Aporte' : '➖ Retiro'}
                      </span>
                    </td>
                    <td translate="no" className="notranslate" style={{ fontWeight: 700 }}>{formatUSD(h.monto_usd)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.notas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'distribuir' && (
        <div className="card">
          <h3 className="card-title mb-16">Calcular y Ejecutar Distribución de Utilidad</h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <input type="date" className="form-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <input type="date" className="form-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleCalcular} disabled={calculando}>
              {calculando ? 'Calculando...' : '🧮 Calcular Utilidad a Repartir'}
            </button>
          </div>

          {preview && (
            <div className="card" style={{ backgroundColor: 'rgba(0,210,255,0.05)', border: '1px solid var(--border-color)', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ganancia del Período</div>
                  <div translate="no" className="notranslate" style={{ fontWeight: 800, fontSize: '18px', color: 'var(--accent-success)' }}>{formatUSD(preview.ganancia_total_usd)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Equivalente en Bs (a repartir)</div>
                  <div translate="no" className="notranslate" style={{ fontWeight: 800, fontSize: '18px', color: '#a855f7' }}>{formatBs(preview.ganancia_total_bs)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tasa Usada</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{preview.tasa_dolar_usada} Bs/$</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capital Total Considerado</div>
                  <div translate="no" className="notranslate" style={{ fontWeight: 800, fontSize: '18px' }}>{formatUSD(preview.capital_total_usd)}</div>
                </div>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Socio</th><th>Capital (USD)</th><th>%</th><th>Le Corresponde (Bs)</th><th>Equivalente USD</th></tr>
                  </thead>
                  <tbody>
                    {(preview.detalle || []).map(d => (
                      <tr key={d.socio_id}>
                        <td style={{ fontWeight: 600 }}>{nombreSocio(d.socio_id)}</td>
                        <td translate="no" className="notranslate">{formatUSD(d.capital_usd)}</td>
                        <td style={{ fontWeight: 700 }}>{Number(d.porcentaje).toFixed(2)}%</td>
                        <td translate="no" className="notranslate" style={{ fontWeight: 800, color: '#a855f7' }}>{formatBs(d.monto_bs)}</td>
                        <td translate="no" className="notranslate" style={{ color: 'var(--text-muted)' }}>{formatUSD(d.monto_usd_informativo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button className="btn btn-primary" onClick={() => setShowConfirmDistribucion(true)}>
                  ✅ Confirmar y Ejecutar Distribución
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                Esta acción marcará las ventas del rango como distribuidas y no podrá repartirse de nuevo.
              </p>
            </div>
          )}

          <div className="card-header" style={{ marginTop: '8px' }}>
            <h3 className="card-title">Historial de Distribuciones Ejecutadas</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Fecha Ejecución</th><th>Período</th><th>Ganancia USD</th><th>Repartido en Bs</th><th>Tasa</th></tr>
              </thead>
              <tbody>
                {distribuciones.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Aún no se ha ejecutado ninguna distribución.</td></tr>
                ) : distribuciones.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize: '12px' }}>{new Date(d.created_at).toLocaleString()}</td>
                    <td style={{ fontSize: '12px' }}>{d.fecha_desde} a {d.fecha_hasta}</td>
                    <td translate="no" className="notranslate">{formatUSD(d.ganancia_total_usd)}</td>
                    <td translate="no" className="notranslate" style={{ fontWeight: 700, color: '#a855f7' }}>{formatBs(d.ganancia_total_bs)}</td>
                    <td>{d.tasa_dolar_usada} Bs/$</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pagos' && (
        <div className="card">
          <h3 className="card-title mb-16">Saldo de Utilidad Pendiente por Socio</h3>
          {socios.length === 0 ? (
            <p className="text-muted center-text" style={{ padding: '24px' }}>No hay socios registrados.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Socio</th><th>Saldo de Utilidad (Bs)</th><th style={{ textAlign: 'center' }}>Acciones</th></tr>
                </thead>
                <tbody>
                  {socios.map(s => {
                    const saldo = Number(utilidadMap[s.auth_user_id] || 0)
                    return (
                      <tr key={s.auth_user_id}>
                        <td style={{ fontWeight: 600 }}>{s.nombres} {s.apellidos}</td>
                        <td translate="no" className="notranslate" style={{ fontWeight: 800, color: '#a855f7' }}>{formatBs(saldo)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-sm"
                            style={{ backgroundColor: 'rgba(0,210,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,210,255,0.2)' }}
                            onClick={() => openPagoModal(s)}
                            disabled={saldo <= 0}
                          >
                            💸 Registrar Pago
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="card-header" style={{ marginTop: '24px' }}>
            <h3 className="card-title">Historial de Utilidad (Asignaciones y Pagos)</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Monto (Bs)</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {utilidadHistorial.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Sin movimientos registrados.</td></tr>
                ) : utilidadHistorial.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: '12px' }}>{new Date(h.created_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{nombreSocio(h.socio_id)}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: h.tipo_movimiento === 'utilidad_asignada' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: h.tipo_movimiento === 'utilidad_asignada' ? '#22c55e' : '#ef4444'
                      }}>
                        {h.tipo_movimiento === 'utilidad_asignada' ? '➕ Asignada' : '➖ Pagada'}
                      </span>
                    </td>
                    <td translate="no" className="notranslate" style={{ fontWeight: 700 }}>{formatBs(h.monto_bs)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.notas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCapitalModal && (
        <div className="modal-overlay" onClick={() => setShowCapitalModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>{capitalModalTipo === 'aporte' ? '➕' : '➖'}</div>
              <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
                {capitalModalTipo === 'aporte' ? 'Registrar Aporte de Capital' : 'Registrar Retiro de Capital'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Socio: <strong>{socioSeleccionado?.nombres} {socioSeleccionado?.apellidos}</strong>
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                Capital actual: <strong translate="no" className="notranslate">{formatUSD(capitalMap[socioSeleccionado?.auth_user_id] || 0)}</strong>
              </p>
            </div>
            <div className="form-group mb-24">
              <label className="form-label">Monto (USD)</label>
              <input type="number" className="form-input" value={montoCapital} onChange={e => setMontoCapital(e.target.value)} autoFocus />
            </div>
            <div className="form-group mb-24">
              <label className="form-label">Notas (opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Recarga de saldo de la API el 16/06"
                value={notasCapital}
                onChange={e => setNotasCapital(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handleRegistrarCapital} style={{ flex: 1 }} disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Confirmar'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowCapitalModal(false)} disabled={isProcessing}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDistribucion && preview && (
        <div className="modal-overlay" onClick={() => setShowConfirmDistribucion(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Confirmar Distribución</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Vas a repartir <strong translate="no" className="notranslate">{formatBs(preview.ganancia_total_bs)}</strong> entre {(preview.detalle || []).length} socio(s)
                y marcar las ventas del {fechaDesde} al {fechaHasta} como distribuidas. Esta acción no se puede revertir desde la app.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handleEjecutarDistribucion} style={{ flex: 1 }} disabled={isProcessing}>
                {isProcessing ? 'Ejecutando...' : 'Sí, Ejecutar Distribución'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowConfirmDistribucion(false)} disabled={isProcessing}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showPagoModal && (
        <div className="modal-overlay" onClick={() => setShowPagoModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💸</div>
              <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Registrar Pago de Utilidad</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Socio: <strong>{socioSeleccionado?.nombres} {socioSeleccionado?.apellidos}</strong>
              </p>
            </div>
            <div className="form-group mb-24">
              <label className="form-label">Monto a Pagar (Bs)</label>
              <input type="number" className="form-input" value={montoPago} onChange={e => setMontoPago(e.target.value)} autoFocus />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Saldo de utilidad actual: <strong translate="no" className="notranslate">{formatBs(utilidadMap[socioSeleccionado?.auth_user_id] || 0)}</strong>
              </p>
            </div>
            <div className="form-group mb-24">
              <label className="form-label">Referencia / Notas</label>
              <input type="text" className="form-input" placeholder="Ej: Pago móvil 1234..." value={notasPago} onChange={e => setNotasPago(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handlePagarUtilidad} style={{ flex: 1 }} disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowPagoModal(false)} disabled={isProcessing}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <AlertModal isOpen={!!alertModal} type={alertModal.type} message={alertModal.message} onConfirm={() => setAlertModal(null)} />
      )}
    </div>
  )
}
