import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import FloatingBackground from './FloatingBackground'
import { hasRole } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function GestionPines() {
  const { perfil, user } = useAuth()
  const isAdmin = hasRole(perfil, 'admin', 'administrador')
  const [pines, setPines] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  
  const [formData, setFormData] = useState({
    cantidad: '1',
    longitud: '12',
    monto: '',
    moneda: 'usd',
    prefijo: ''
  })

  useEffect(() => {
    if (isAdmin) {
      fetchPines()
    }
  }, [isAdmin])

  const fetchPines = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('pines')
      .select('*')
      .order('creado_en', { ascending: false })
      
    if (data && data.length > 0) {
      // Fetch user details separately if there are redeemed pins
      const userIds = [...new Set(data.filter(p => p.canjeado_por).map(p => p.canjeado_por))]
      
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('clientes')
          .select('auth_user_id, nombres, apellidos, email')
          .in('auth_user_id', userIds)
          
        if (usersData) {
          const userMap = new Map(usersData.map(u => [u.auth_user_id, u]))
          const pinesWithUsers = data.map(pin => ({
            ...pin,
            canjeado_por_user: pin.canjeado_por ? userMap.get(pin.canjeado_por) : null
          }))
          setPines(pinesWithUsers)
          setLoading(false)
          return
        }
      }
      setPines(data)
    } else {
      setPines([])
    }
    setLoading(false)
  }

  const openNewModal = () => {
    setFormData({
      cantidad: '1',
      longitud: '12',
      monto: '',
      moneda: 'usd',
      prefijo: ''
    })
    setShowModal(true)
  }

  const generateRandomCode = (length, prefix) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = prefix ? prefix.toUpperCase() : ''
    const remainingLength = length - result.length
    for (let i = 0; i < remainingLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cant = parseInt(formData.cantidad)
    const long = parseInt(formData.longitud)
    const monto = parseFloat(formData.monto)
    
    if (isNaN(cant) || cant <= 0 || cant > 100) {
      setAlertModal({ type: 'warning', message: 'La cantidad debe ser entre 1 y 100' })
      return
    }
    if (isNaN(long) || long < 6 || long > 30) {
      setAlertModal({ type: 'warning', message: 'La longitud debe ser entre 6 y 30' })
      return
    }
    if (isNaN(monto) || monto <= 0) {
      setAlertModal({ type: 'warning', message: 'El monto debe ser mayor a 0' })
      return
    }

    const newPines = []
    for (let i = 0; i < cant; i++) {
      newPines.push({
        codigo: generateRandomCode(long, formData.prefijo),
        monto: monto,
        moneda: formData.moneda,
        estado: 'activo'
      })
    }
    
    const { error } = await supabase.from('pines').insert(newPines)
    
    if (error) {
      setAlertModal({ type: 'error', message: 'Error al generar los pines: ' + error.message })
    } else {
      setAlertModal({ type: 'success', message: `${cant} pin(es) generado(s) exitosamente` })
      setShowModal(false)
      fetchPines()
    }
  }

  const deletePin = (id) => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Pin',
      message: '¿Estás seguro de eliminar este pin? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setAlertModal(null)
        const { error } = await supabase.from('pines').delete().eq('id', id)
        if (!error) fetchPines()
        else setAlertModal({ type: 'error', message: "Error al eliminar: " + error.message })
      }
    })
  }

  if (!isAdmin) {
    return <div style={{ padding: '20px', color: 'red' }}>Acceso denegado</div>
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 0, paddingBottom: '40px' }}>
      <FloatingBackground />
      <div className="landing-container" style={{ position: 'relative', zIndex: 10, paddingTop: '100px' }}>
        
        <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Gestión de Pines 💳</h2>
            <p style={{ color: 'var(--text-muted)' }}>Crea y administra pines de recarga de saldo</p>
          </div>
          <button className="btn btn-primary" onClick={openNewModal}>
            + Generar Pines
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando pines...</div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Monto</th>
                  <th>Moneda</th>
                  <th>Estado</th>
                  <th>Creado el</th>
                  <th>Canjeado por</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pines.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay pines generados</td>
                  </tr>
                ) : (
                  pines.map(p => (
                    <tr key={p.id}>
                      <td><span className="badge" style={{ fontSize: '14px', background: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0, 210, 255, 0.3)', letterSpacing: '1px' }}>{p.codigo}</span></td>
                      <td><span style={{ fontWeight: 800, color: p.moneda === 'usd' ? 'var(--accent-success)' : '#a855f7' }}>{p.monto}</span></td>
                      <td><span style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>{p.moneda}</span></td>
                      <td>
                        <span className={`badge ${p.estado === 'activo' ? 'badge-success' : 'badge-warning'}`}>
                          {p.estado === 'activo' ? 'Activo' : 'Canjeado'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {new Date(p.creado_en).toLocaleDateString()} {new Date(p.creado_en).toLocaleTimeString()}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {p.estado === 'canjeado' ? (
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                              {p.canjeado_por_user?.nombres} {p.canjeado_por_user?.apellidos}
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>{new Date(p.canjeado_en).toLocaleDateString()}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-icon"
                            title="Eliminar"
                            style={{ color: '#ef4444' }}
                            onClick={() => deletePin(p.id)}
                            disabled={p.estado === 'canjeado'}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Generar Pines */}
        {showModal && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1000 }} onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              maxWidth: '550px', 
              width: '95%', 
              padding: '40px', 
              borderRadius: '28px', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)' 
            }}>
              <div className="modal-header" style={{ marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <h3 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Generar Pines</h3>
                <button className="btn-close" style={{ fontSize: '28px', width: '40px', height: '40px' }} onClick={() => setShowModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-primary)' }}>Cantidad de Pines *</label>
                      <input 
                        type="number" min="1" max="100"
                        className="input-field" 
                        value={formData.cantidad} 
                        onChange={e => setFormData({...formData, cantidad: e.target.value})}
                        style={{ height: '48px', fontSize: '18px', textAlign: 'center' }}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>Longitud del Código *</label>
                      <input 
                        type="number" min="6" max="30"
                        className="input-field" 
                        value={formData.longitud} 
                        onChange={e => setFormData({...formData, longitud: e.target.value})}
                        style={{ height: '48px', fontSize: '18px', textAlign: 'center' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>Prefijo (Opcional)</label>
                    <input 
                      type="text"
                      className="input-field" 
                      value={formData.prefijo} 
                      onChange={e => setFormData({...formData, prefijo: e.target.value.replace(/\s+/g, '').toUpperCase()})}
                      placeholder="Ej: REGALO"
                      style={{ height: '48px', fontSize: '16px', letterSpacing: '1px', textTransform: 'uppercase' }}
                    />
                  </div>

                  <div className="form-row" style={{ display: 'flex', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-success)' }}>Monto a Recargar *</label>
                      <input 
                        type="number" step="0.01" min="0.1"
                        className="input-field" 
                        value={formData.monto} 
                        onChange={e => setFormData({...formData, monto: e.target.value})}
                        placeholder="Ej: 5.00"
                        style={{ height: '56px', fontSize: '22px', fontWeight: 900, textAlign: 'center', color: 'var(--accent-success)' }}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>Moneda *</label>
                      <select 
                        className="input-field" 
                        value={formData.moneda}
                        onChange={e => setFormData({...formData, moneda: e.target.value})}
                        style={{ height: '56px', fontSize: '18px', fontWeight: 'bold' }}
                      >
                        <option value="usd">USD ($)</option>
                        <option value="bs">Bs (Bs)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '16px', padding: '0 24px' }} onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '16px', fontWeight: 800, padding: '0 32px', height: '52px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)', borderRadius: '14px' }}>
                      Generar Pines
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {alertModal && (
          <AlertModal
            isOpen={true}
            type={alertModal.type}
            title={alertModal.title}
            message={alertModal.message}
            onConfirm={() => {
              if (alertModal.onConfirm) alertModal.onConfirm()
              else setAlertModal(null)
            }}
            onCancel={() => {
              if (alertModal.onCancel) alertModal.onCancel()
              setAlertModal(null)
            }}
          />
        )}

      </div>
    </div>
  )
}
