import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'
import { useConfiguracion } from '../hooks/useData'

export default function PagosApk({ onNavigate }) {
  const { updateConfig } = useConfiguracion()
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [apkEnabled, setApkEnabled] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    fetchPagos()
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('valor_texto, valor')
        .eq('clave', 'pagos_apk_enabled')
        .is('owner_id', null)
        .single()
      
      if (!error && data) {
        setApkEnabled(data.valor_texto === 'true' || data.valor === true)
      }
    } catch (err) {
      console.error('Error cargando config APK:', err)
    }
  }

  const toggleApkEnabled = async (checked) => {
    setSavingConfig(true)
    try {
      const res = await updateConfig('pagos_apk_enabled', checked ? 'true' : 'false', true)
      if (res?.error) throw res.error
      
      setApkEnabled(checked)
    } catch (err) {
      console.error('Error actualizando config APK:', err)
      alert('Error al guardar la configuración')
    } finally {
      setSavingConfig(false)
    }
  }

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

  const handleMarkAsUsed = async (pago) => {
    const relacion = window.prompt('Ingrese la relación (ej. Pedido #123, Pago manual, etc.):')
    if (relacion === null) return // Canceled
    if (!relacion.trim()) {
      alert('Debe ingresar una relación válida.')
      return
    }

    try {
      const { error } = await supabase
        .from('pagos_apk')
        .update({ 
          status: 'usado',
          relacion_manual: relacion.trim()
        })
        .eq('id', pago.id)

      if (error) throw error
      
      // Update local state
      setPagos(prev => prev.map(p => 
        p.id === pago.id ? { ...p, status: 'usado', relacion_manual: relacion.trim() } : p
      ))
    } catch (err) {
      console.error('Error al marcar como usado:', err)
      alert('Hubo un error al actualizar el pago.')
    }
  }

  const filteredPagos = pagos.filter(p => 
    p.referencia?.toLowerCase().includes(search.toLowerCase()) ||
    p.telefono?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-content">
      <div className="admin-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ color: 'var(--accent-primary)', margin: 0 }}>Registro de Pagos (APK)</h2>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Base de datos de referencias enviadas desde el teléfono</p>
          </div>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(255,255,255,0.05)', padding: '10px 16px',
            borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-light)', display: 'block' }}>Recepción de Pagos</span>
              <span style={{ fontSize: '11px', color: apkEnabled ? '#10b981' : '#ef4444' }}>
                {apkEnabled ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </div>
            <label className="switch" style={{ margin: 0 }}>
              <input 
                type="checkbox" 
                checked={apkEnabled}
                disabled={savingConfig}
                onChange={(e) => toggleApkEnabled(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
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
                  <th>Acciones</th>
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
                      ) : pago.relacion_manual ? (
                        <span style={{ color: 'var(--text-light)', fontSize: '13px' }}>
                          {pago.relacion_manual}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Sin relación</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${pago.status === 'usado' ? 'status-completed' : 'status-pending'}`}>
                        {pago.status}
                      </span>
                    </td>
                    <td>
                      {pago.status !== 'usado' && (
                        <button 
                          className="btn-secondary" 
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          onClick={() => handleMarkAsUsed(pago)}
                          title="Marcar pago como usado manualmente"
                        >
                          Marcar Usado
                        </button>
                      )}
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
