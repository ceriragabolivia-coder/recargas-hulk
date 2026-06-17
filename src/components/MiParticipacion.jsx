import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'

export default function MiParticipacion() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: res, error } = await supabase.rpc('obtener_mi_participacion_rpc')
      if (error) throw error
      if (!res?.success) throw new Error(res?.error || 'No se pudo cargar tu información')
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return <div className="page-content center-flex"><div className="spinner"></div><p>Cargando tu participación...</p></div>
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent-error)' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchData} style={{ marginTop: '16px' }}>Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <div>
          <h1 className="page-title">Mi Participación</h1>
          <p className="page-subtitle">Tu capital aportado, tu porcentaje de participación y tu saldo de utilidad.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchData}>🔄 Refrescar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mi Capital Aportado</div>
          <div translate="no" className="notranslate" style={{ fontWeight: 800, fontSize: '24px', color: 'var(--accent-success)', marginTop: '8px' }}>
            {formatUSD(data.capital_propio_usd)}
          </div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mi % de Participación</div>
          <div style={{ fontWeight: 800, fontSize: '24px', marginTop: '8px' }}>
            {Number(data.porcentaje).toFixed(2)}%
          </div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Saldo de Utilidad Pendiente</div>
          <div translate="no" className="notranslate" style={{ fontWeight: 800, fontSize: '24px', color: '#a855f7', marginTop: '8px' }}>
            {formatBs(data.saldo_utilidad_bs)}
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title">Historial de Mi Capital</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Monto (USD)</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {(data.historial_capital || []).length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Aún no tienes movimientos de capital.</td></tr>
              ) : data.historial_capital.map((h, idx) => (
                <tr key={idx}>
                  <td style={{ fontSize: '12px' }}>{new Date(h.created_at).toLocaleString()}</td>
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

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Historial de Mi Utilidad</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Monto (Bs)</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {(data.historial_utilidad || []).length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Aún no tienes movimientos de utilidad.</td></tr>
              ) : data.historial_utilidad.map((h, idx) => (
                <tr key={idx}>
                  <td style={{ fontSize: '12px' }}>{new Date(h.created_at).toLocaleString()}</td>
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
    </div>
  )
}
