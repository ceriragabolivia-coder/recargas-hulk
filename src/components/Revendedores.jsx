import React, { useState, useMemo } from 'react'
import { useClientes, useJuegos } from '../hooks/useData'
import AlertModal from './AlertModal'

export default function Revendedores({ onNavigate }) {
  const { clientes, loading: loadingClientes, updateProfileRoleAndDiscount, updateProfileStatus, refetch: refetchClientes } = useClientes()
  const { juegos, loading: loadingJuegos, updateJuego } = useJuegos()
  
  const [activeTab, setActiveTab] = useState('cuentas') // 'cuentas' | 'descuentos'
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  
  // Pestaña Cuentas
  const [searchTerm, setSearchTerm] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [editingData, setEditingData] = useState({})

  // Pestaña Descuentos Globales
  const [editingJuego, setEditingJuego] = useState(null)
  const [juegoDescuento, setJuegoDescuento] = useState('')

  // Filtrar solo revendedores
  const revendedores = useMemo(() => {
    let list = clientes.filter(c => c.rol === 'revendedor')
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter(c => 
        (c.nombres?.toLowerCase().includes(term)) ||
        (c.apellidos?.toLowerCase().includes(term)) ||
        (c.usuario?.toLowerCase().includes(term))
      )
    }
    return list
  }, [clientes, searchTerm])

  const handleEditClick = (cliente) => {
    setEditingRow(cliente.id)
    setEditingData({
      estado: cliente.estado || 'pendiente',
      porcentaje_descuento: cliente.porcentaje_descuento || 0
    })
  }

  const handleSaveClick = async (cliente) => {
    setSaving(true)
    try {
      if (cliente.auth_user_id) {
        await updateProfileRoleAndDiscount(cliente.auth_user_id, {
          rol: 'revendedor', // Siempre revendedor
          porcentaje_descuento: parseFloat(editingData.porcentaje_descuento || 0),
          estado: editingData.estado
        })
      }
      await refetchClientes()
      setEditingRow(null)
    } catch (error) {
      setAlertModal({ type: 'error', message: "Error al guardar: " + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleEditJuegoClick = (juego) => {
    setEditingJuego(juego.id)
    setJuegoDescuento(juego.descuento_revendedor || '0')
  }

  const handleGuardarDescuentoJuego = async (juego) => {
    setSaving(true)
    try {
      const desc = parseFloat(juegoDescuento || 0)
      const { error } = await updateJuego(juego.id, { descuento_revendedor: desc })
      if (error) throw error
      
      setAlertModal({ type: 'success', message: 'Descuento global actualizado correctamente' })
      setEditingJuego(null)
    } catch (error) {
      setAlertModal({ type: 'error', message: "Error al guardar descuento: " + error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: '100%', padding: '0 24px', margin: '0 auto' }}>
      <div className="page-header mb-24">
        <h1 className="page-title">Módulo de Revendedores</h1>
        <p className="page-subtitle">Gestiona las cuentas de los revendedores y configura los descuentos globales por servicio</p>
      </div>

      <div className="tabs mb-24" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px' }}>
        <button 
          className={`tab-btn ${activeTab === 'cuentas' ? 'active' : ''}`}
          style={{ padding: '12px 24px', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'cuentas' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'cuentas' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: activeTab === 'cuentas' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '15px' }}
          onClick={() => setActiveTab('cuentas')}
        >
          👥 Cuentas de Revendedores
        </button>
        <button 
          className={`tab-btn ${activeTab === 'descuentos' ? 'active' : ''}`}
          style={{ padding: '12px 24px', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'descuentos' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: activeTab === 'descuentos' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: activeTab === 'descuentos' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '15px' }}
          onClick={() => setActiveTab('descuentos')}
        >
          🏷️ Descuentos por Servicio
        </button>
      </div>

      <div className="card">
        {activeTab === 'cuentas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ position: 'relative', width: '300px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="🔍 Buscar revendedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '400px', textAlign: 'right' }}>
                Para <strong>agregar</strong> un nuevo revendedor, ve a "Usuarios", edita su perfil y cambia su rol a Revendedor.
              </p>
            </div>

            <div className="table-container">
              {loadingClientes ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando revendedores...</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Revendedor</th>
                      <th>Contacto</th>
                      <th>Estatus</th>
                      <th>Descuento Personal</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revendedores.map(cliente => {
                      const isEditing = editingRow === cliente.id
                      return (
                        <tr key={cliente.id} style={{ backgroundColor: isEditing ? 'rgba(52, 152, 219, 0.05)' : 'transparent' }}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cliente.nombres} {cliente.apellidos}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{cliente.usuario}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>📱 {cliente.whatsapp || 'No registrado'}</div>
                          </td>
                          <td>
                            {isEditing ? (
                              <select 
                                className="form-input" 
                                style={{ padding: '6px', fontSize: '12px', width: '120px' }}
                                value={editingData.estado}
                                onChange={(e) => setEditingData({...editingData, estado: e.target.value})}
                              >
                                <option value="aprobado">🟢 Aprobado</option>
                                <option value="pendiente">⏳ Pendiente</option>
                                <option value="rechazado">🔴 Rechazado</option>
                                <option value="suspendido">🚫 Suspendido</option>
                                <option value="baneado">💀 Baneado</option>
                              </select>
                            ) : (
                              <span style={{ 
                                display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                                backgroundColor: cliente.estado === 'aprobado' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                                color: cliente.estado === 'aprobado' ? '#22c55e' : '#9ca3af',
                                border: `1px solid ${cliente.estado === 'aprobado' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`
                              }}>
                                {cliente.estado}
                              </span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ position: 'relative', width: '80px' }}>
                                  <input 
                                    type="number" className="form-input" style={{ padding: '4px 20px 4px 8px', fontSize: '13px' }}
                                    value={editingData.porcentaje_descuento}
                                    onChange={(e) => setEditingData({...editingData, porcentaje_descuento: e.target.value})} min="0" max="100"
                                  />
                                  <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>%</span>
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-info">{cliente.porcentaje_descuento || 0}%</span>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Aplica si no hay uno específico
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleSaveClick(cliente)} disabled={saving}>{saving ? '...' : 'Guardar'}</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingRow(null)}>✕</button>
                              </div>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleEditClick(cliente)} title="Editar cuenta">✏️ Editar</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {revendedores.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay revendedores registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'descuentos' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Configura un <strong>descuento global (%)</strong> para revendedores en cada servicio. Si un paquete específico tiene su propio descuento configurado, <strong>ese descuento prevalecerá</strong> y este global será ignorado para ese paquete.
              </p>
            </div>

            <div className="table-container">
              {loadingJuegos ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando servicios...</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Logo</th>
                      <th>Servicio / Juego</th>
                      <th>Fórmula de Precio</th>
                      <th>Descuento Global (Revendedor)</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {juegos.map(juego => {
                      const isEditing = editingJuego === juego.id
                      return (
                        <tr key={juego.id} style={{ backgroundColor: isEditing ? 'rgba(52, 152, 219, 0.05)' : 'transparent' }}>
                          <td>
                            <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {juego.icono_url ? <img loading="lazy" decoding="async" src={juego.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎮'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{juego.nombre}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {juego.activo ? '🟢 Activo' : '🔴 Inactivo'}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {juego.tipo_calculo.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ position: 'relative', width: '90px' }}>
                                  <input 
                                    type="number" className="form-input" style={{ padding: '6px 20px 6px 8px', fontSize: '14px' }}
                                    value={juegoDescuento}
                                    onChange={(e) => setJuegoDescuento(e.target.value)} min="0" max="100" step="0.5"
                                  />
                                  <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-muted)' }}>%</span>
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: '13px', padding: '6px 10px' }}>
                                {juego.descuento_revendedor || 0}%
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleGuardarDescuentoJuego(juego)} disabled={saving}>{saving ? '...' : 'Guardar'}</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingJuego(null)}>✕</button>
                              </div>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleEditJuegoClick(juego)}>
                                ✏️ Configurar Descuento
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={() => setAlertModal(null)}
          onCancel={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
