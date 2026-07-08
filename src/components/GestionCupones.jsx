import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import FloatingBackground from './FloatingBackground'
import { hasRole } from '../utils/helpers'

export default function GestionCupones({ onNavigate }) {
  const { perfil, user } = useAuth()
  const isAdmin = hasRole(perfil, 'admin', 'administrador')
  const [cupones, setCupones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  
  const [formData, setFormData] = useState({
    codigo: '',
    porcentaje_descuento: '',
    max_usos_global: '',
    max_usos_usuario: '1',
    fecha_inicio: '',
    fecha_fin: ''
  })
  
  const [assignData, setAssignData] = useState({
    cupon_id: null,
    searchEmail: '',
    searchResults: [],
    isSearching: false,
    selectedUser: null
  })

  useEffect(() => {
    if (isAdmin) {
      fetchCupones()
    }
  }, [isAdmin])

  const fetchCupones = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cupones')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) setCupones(data)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.codigo || !formData.porcentaje_descuento) {
      alert("El código y el porcentaje son obligatorios")
      return
    }
    
    const payload = {
      codigo: formData.codigo.toUpperCase(),
      porcentaje_descuento: parseFloat(formData.porcentaje_descuento),
      max_usos_global: formData.max_usos_global ? parseInt(formData.max_usos_global) : null,
      max_usos_usuario: formData.max_usos_usuario ? parseInt(formData.max_usos_usuario) : 1,
      fecha_inicio: formData.fecha_inicio ? new Date(formData.fecha_inicio).toISOString() : null,
      fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null
    }

    const { error } = await supabase.from('cupones').insert([payload])
    
    if (error) {
      alert('Error al crear el cupón: ' + error.message)
    } else {
      alert('Cupón creado exitosamente')
      setShowModal(false)
      fetchCupones()
      setFormData({
        codigo: '',
        porcentaje_descuento: '',
        max_usos_global: '',
        max_usos_usuario: '1',
        fecha_inicio: '',
        fecha_fin: ''
      })
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    const { error } = await supabase.from('cupones').update({ activo: !currentStatus }).eq('id', id)
    if (!error) fetchCupones()
  }
  
  const deleteCupon = async (id) => {
    if (confirm("¿Estás seguro de eliminar este cupón? Esta acción no se puede deshacer y borrará los usos del mismo.")) {
      const { error } = await supabase.from('cupones').delete().eq('id', id)
      if (!error) fetchCupones()
      else alert("Error al eliminar: " + error.message)
    }
  }

  const searchUser = async (emailOrNickname) => {
    if (!emailOrNickname || emailOrNickname.length < 3) return
    setAssignData(prev => ({ ...prev, isSearching: true }))
    
    const { data: usersData } = await supabase
      .from('clientes')
      .select('id, auth_user_id, nombres, apellidos, nickname, email')
      .or(`email.ilike.%${emailOrNickname}%,nickname.ilike.%${emailOrNickname}%`)
      .limit(10)
      
    setAssignData(prev => ({ ...prev, searchResults: usersData || [], isSearching: false }))
  }

  const handleAssignSubmit = async (e) => {
    e.preventDefault()
    if (!assignData.cupon_id || !assignData.selectedUser) {
      alert("Selecciona un cupón y un usuario")
      return
    }

    const { data, error } = await supabase.rpc('asignar_cupon_usuario_rpc', {
      p_cupon_id: assignData.cupon_id,
      p_usuario_id: assignData.selectedUser.auth_user_id
    })

    if (error) {
      alert("Error al asignar: " + error.message)
    } else if (data && !data.success) {
      alert(data.message)
    } else {
      alert("Cupón asignado y notificado exitosamente al usuario")
      setShowAssignModal(false)
      setAssignData({ cupon_id: null, searchEmail: '', searchResults: [], isSearching: false, selectedUser: null })
    }
  }

  if (!isAdmin) {
    return <div style={{ padding: '20px', color: 'red' }}>Acceso denegado</div>
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 0, paddingBottom: '40px' }}>
      <FloatingBackground />
      <div className="landing-container" style={{ position: 'relative', zIndex: 10, paddingTop: '100px' }}>
        
        <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Gestión de Cupones 🎟️</h2>
            <p style={{ color: 'var(--text-muted)' }}>Crea y administra códigos de descuento</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Nuevo Cupón
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando cupones...</div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descuento</th>
                  <th>Usos Globales</th>
                  <th>Límite x Usuario</th>
                  <th>Fechas (Inicio - Fin)</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cupones.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay cupones creados</td>
                  </tr>
                ) : (
                  cupones.map(c => (
                    <tr key={c.id}>
                      <td><span className="badge" style={{ fontSize: '14px', background: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0, 210, 255, 0.3)' }}>{c.codigo}</span></td>
                      <td><span style={{ fontWeight: 800, color: 'var(--accent-success)' }}>{c.porcentaje_descuento}%</span></td>
                      <td>{c.usos_actuales} / {c.max_usos_global || '∞'}</td>
                      <td>{c.max_usos_usuario || '∞'}</td>
                      <td style={{ fontSize: '12px' }}>
                        <div>{c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : 'Siempre'} -</div>
                        <div>{c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString() : 'Sin expiración'}</div>
                      </td>
                      <td>
                        <span className={`badge ${c.activo ? 'badge-success' : 'badge-error'}`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-icon"
                            title="Regalar a usuario"
                            style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}
                            onClick={() => { setAssignData(prev => ({...prev, cupon_id: c.id})); setShowAssignModal(true) }}
                          >
                            🎁
                          </button>
                          <button 
                            className="btn btn-icon" 
                            title={c.activo ? 'Desactivar' : 'Activar'}
                            onClick={() => toggleStatus(c.id, c.activo)}
                          >
                            {c.activo ? '⏸️' : '▶️'}
                          </button>
                          <button 
                            className="btn btn-icon"
                            title="Eliminar"
                            style={{ color: '#ef4444' }}
                            onClick={() => deleteCupon(c.id)}
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

        {/* Modal Crear Cupón */}
        {showModal && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1000 }} onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              maxWidth: '650px', 
              width: '95%', 
              padding: '40px', 
              borderRadius: '28px', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)' 
            }}>
              <div className="modal-header" style={{ marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <h3 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Crear Nuevo Cupón</h3>
                <button className="btn-close" style={{ fontSize: '28px', width: '40px', height: '40px' }} onClick={() => setShowModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-primary)' }}>🎟️ Código del Cupón *</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formData.codigo} 
                        onChange={e => setFormData({...formData, codigo: e.target.value.replace(/\s+/g, '').toUpperCase()})}
                        placeholder="Ej: VERANO20"
                        style={{ height: '56px', fontSize: '18px', fontWeight: 800, letterSpacing: '2px', textAlign: 'center', textTransform: 'uppercase' }}
                        required
                      />
                    </div>
                    
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-success)' }}>💰 Descuento (%) *</label>
                      <input 
                        type="number" 
                        min="1" max="100" step="0.01"
                        className="input-field" 
                        value={formData.porcentaje_descuento} 
                        onChange={e => setFormData({...formData, porcentaje_descuento: e.target.value})}
                        placeholder="20"
                        style={{ height: '56px', fontSize: '22px', fontWeight: 900, textAlign: 'center', color: 'var(--accent-success)' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'flex', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>🌎 Límite de usos global</label>
                      <input 
                        type="number" min="1"
                        className="input-field" 
                        value={formData.max_usos_global} 
                        onChange={e => setFormData({...formData, max_usos_global: e.target.value})}
                        placeholder="Ilimitado"
                        style={{ height: '48px', fontSize: '16px' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Total de veces que se puede usar en toda la web.</small>
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>👤 Límite por persona</label>
                      <input 
                        type="number" min="1"
                        className="input-field" 
                        value={formData.max_usos_usuario} 
                        onChange={e => setFormData({...formData, max_usos_usuario: e.target.value})}
                        placeholder="1"
                        style={{ height: '48px', fontSize: '16px' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Veces que cada usuario puede usar este código.</small>
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>🕒 Fecha de Inicio (Opcional)</label>
                      <input 
                        type="datetime-local" 
                        className="input-field" 
                        value={formData.fecha_inicio} 
                        onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                        style={{ height: '48px', color: formData.fecha_inicio ? 'var(--text-primary)' : 'var(--text-muted)' }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>⏳ Fecha de Vencimiento (Opcional)</label>
                      <input 
                        type="datetime-local" 
                        className="input-field" 
                        value={formData.fecha_fin} 
                        onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                        style={{ height: '48px', color: formData.fecha_fin ? 'var(--text-primary)' : 'var(--text-muted)' }}
                      />
                    </div>
                  </div>

                  <div className="form-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '16px', padding: '0 24px' }} onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '16px', fontWeight: 800, padding: '0 32px', height: '52px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)', borderRadius: '14px' }}>
                      Guardar Cupón
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal Asignar Cupón a Usuario */}
        {showAssignModal && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>Regalar Cupón a Usuario</h3>
                <button className="btn-close" onClick={() => setShowAssignModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {!assignData.selectedUser ? (
                    <div className="form-group">
                      <label>Buscar usuario (Email o Nickname)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={assignData.searchEmail} 
                          onChange={e => setAssignData({...assignData, searchEmail: e.target.value})}
                          placeholder="Ej: juan@email.com"
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => searchUser(assignData.searchEmail)}
                        >
                          Buscar
                        </button>
                      </div>
                      
                      {assignData.isSearching && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Buscando...</p>}
                      
                      {assignData.searchResults.length > 0 && (
                        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                          {assignData.searchResults.map(u => (
                            <div 
                              key={u.id}
                              onClick={() => setAssignData({...assignData, selectedUser: u, searchResults: []})}
                              style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}
                              className="user-search-result"
                            >
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {(u.nombres || u.nickname || u.email || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 'bold' }}>{u.nombres} {u.apellidos} {u.nickname ? `(${u.nickname})` : ''}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Usuario Seleccionado:</label>
                      <div style={{ padding: '12px', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{assignData.selectedUser.nombres}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{assignData.selectedUser.email}</div>
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-ghost btn-sm"
                          onClick={() => setAssignData({...assignData, selectedUser: null})}
                        >
                          Cambiar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="form-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowAssignModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={!assignData.selectedUser} style={{ background: 'linear-gradient(135deg, #a855f7 0%, #d8b4fe 100%)', color: '#000' }}>
                      🎁 Enviar Regalo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
