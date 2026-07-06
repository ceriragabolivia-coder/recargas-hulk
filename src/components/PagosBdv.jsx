import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatBs } from '../utils/helpers'
import { useAuth } from '../hooks/useData'

export default function PagosBdv() {
  const { isAdmin } = useAuth()
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPagos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pagos_bdv_notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setPagos(data || [])
    } catch (err) {
      console.error('Error al cargar pagos BDV:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPagos()

    // Suscripción en tiempo real para nuevos pagos
    const channel = supabase
      .channel('pagos_bdv_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pagos_bdv_notificaciones'
      }, payload => {
        setPagos(prev => [payload.new, ...prev].slice(0, 100))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPagos()
  }

  return (
    <div className="page-content">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
              <span>🏦</span> Pagos Móviles Automáticos
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 0 0', fontSize: '14px' }}>
              Base de datos en tiempo real de los pagos capturados por la App Hulk.
            </p>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {refreshing ? '↻ Cargando...' : '↻ Actualizar Tabla'}
          </button>
        </div>

        {loading && !refreshing ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando pagos...</div>
        ) : pagos.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
            <span style={{ fontSize: '32px', opacity: 0.5 }}>📱</span>
            <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Aún no hay notificaciones de pago registradas en la base de datos.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Referencia</th>
                  <th>Monto (Bs)</th>
                  <th>Estado</th>
                  <th>Detalle Original</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => {
                  const dateStr = new Date(pago.created_at).toLocaleString('es-VE', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                  })
                  
                  return (
                    <tr key={pago.id} style={{ transition: 'all 0.2s', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{dateStr}</td>
                      <td>
                        <span style={{ 
                          background: 'rgba(255, 255, 255, 0.1)', 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          color: '#fff',
                          letterSpacing: '1px'
                        }}>
                          {pago.referencia}
                        </span>
                      </td>
                      <td style={{ color: '#a855f7', fontWeight: 'bold' }}>
                        {formatBs(pago.monto_bs)}
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          background: pago.estado === 'procesado' ? 'rgba(57, 255, 20, 0.15)' : 
                                      pago.estado === 'error' ? 'rgba(255, 59, 48, 0.15)' : 
                                      'rgba(245, 158, 11, 0.15)',
                          color: pago.estado === 'procesado' ? 'var(--accent-success)' : 
                                 pago.estado === 'error' ? 'var(--accent-danger)' : 
                                 'var(--accent-warning)',
                          border: `1px solid ${
                                 pago.estado === 'procesado' ? 'var(--accent-success)' : 
                                 pago.estado === 'error' ? 'var(--accent-danger)' : 
                                 'var(--accent-warning)'
                          }`
                        }}>
                          {pago.estado || 'Pendiente'}
                        </span>
                        {pago.pedido_id && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Pedido #{pago.pedido_id}
                          </div>
                        )}
                      </td>
                      <td style={{ 
                        fontSize: '11px', 
                        color: 'var(--text-muted)', 
                        maxWidth: '250px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={pago.texto_original}>
                        {pago.texto_original}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
