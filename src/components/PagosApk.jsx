import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'

export default function PagosApk({ onNavigate }) {
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchPagos()
  }, [])

  const fetchPagos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pagos_apk')
        .select('*, pedidos(numero_pedido)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setPagos(data || [])
    } catch (err) {
      console.error('Error cargando pagos apk:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredPagos = pagos.filter(p => 
    p.referencia?.toLowerCase().includes(search.toLowerCase()) ||
    p.telefono?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-content">
      <div className="admin-header">
        <h2 style={{ color: 'var(--accent-primary)' }}>Registro de Pagos (APK)</h2>
        <p style={{ color: 'var(--text-muted)' }}>Base de datos de referencias enviadas desde el teléfono</p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Buscar por referencia o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
          <button className="btn-primary" onClick={fetchPagos}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando pagos...</div>
        ) : filteredPagos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No se encontraron pagos.</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th>Monto</th>
                  <th>Banco</th>
                  <th>Teléfono</th>
                  <th>Relación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPagos.map((pago) => (
                  <tr key={pago.id}>
                    <td>
                      {new Date(pago.fecha_pago || pago.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>
                      {pago.referencia}
                    </td>
                    <td style={{ color: 'var(--accent-primary)' }}>
                      Bs. {pago.monto?.toLocaleString('es-VE')}
                    </td>
                    <td>
                      {pago.banco_origen || '-'} {pago.banco_destino ? `-> ${pago.banco_destino}` : ''}
                    </td>
                    <td>
                      {pago.telefono || '-'}
                    </td>
                    <td>
                      {pago.pedidos ? (
                        <span 
                          onClick={() => onNavigate && onNavigate('pedidos', { orderNumber: pago.pedidos.numero_pedido })}
                          style={{ color: '#00ff00', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Clic para ir al pedido"
                        >
                          Pedido #{pago.pedidos.numero_pedido}
                        </span>
                      ) : pago.usuario_id && pago.status === 'usado' ? (
                        <span 
                          onClick={() => onNavigate && onNavigate('usuarios', { openWalletUserId: pago.usuario_id })}
                          style={{ color: '#0ea5e9', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Clic para ver billetera del usuario"
                        >
                          Recarga de Billetera
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Sin relación</span>
                      )}
                    </td>
                    <td>
                      <span className="status-badge status-completed">
                        {pago.status}
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
  )
}
