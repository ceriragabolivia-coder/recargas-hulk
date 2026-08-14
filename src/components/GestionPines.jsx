import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useConfiguracion } from '../hooks/useData'
import FloatingBackground from './FloatingBackground'
import { hasRole } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function GestionPines() {
  const { perfil, user } = useAuth()
  const { config, updateConfig } = useConfiguracion()
  const isAdmin = hasRole(perfil, 'admin', 'administrador')
  const [pines, setPines] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [savingConfig, setSavingConfig] = useState(false)
  const [selectedPins, setSelectedPins] = useState([])
  const itemsPerPage = 10
  
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
          .select('*')
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setAlertModal({ type: 'success', message: '¡Código copiado al portapapeles!' })
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
    
    // Cryptographically secure random generation
    const randomArray = new Uint32Array(remainingLength)
    window.crypto.getRandomValues(randomArray)
    
    for (let i = 0; i < remainingLength; i++) {
      result += chars[randomArray[i] % chars.length]
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

  // El valor en DB es en SEGUNDOS totales
  const cooldownSecs = Number(config?.tiempo_espera_pines ?? 300)
  const cooldownMins = Math.floor(cooldownSecs / 60)
  const cooldownSegsRest = cooldownSecs % 60

  const handleUpdateCooldown = async (mins, segs) => {
    const totalSegs = (parseInt(mins) || 0) * 60 + (parseInt(segs) || 0)
    if (totalSegs < 0) return
    setSavingConfig(true)
    try {
      await updateConfig('tiempo_espera_pines', totalSegs, false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingConfig(false)
    }
  }

  const filteredPines = pines.filter(p => {
    const term = searchTerm.toLowerCase();
    if (p.codigo.toLowerCase().includes(term)) return true;
    if (p.canjeado_por_user) {
      const u = p.canjeado_por_user;
      if (u.nombres?.toLowerCase().includes(term)) return true;
      if (u.apellidos?.toLowerCase().includes(term)) return true;
      if (u.email?.toLowerCase().includes(term)) return true;
    }
    return false;
  })

  const totalPages = Math.ceil(filteredPines.length / itemsPerPage)
  
  // Si la búsqueda reduce los resultados y la página actual es mayor que el total de páginas, volver a la página 1
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [filteredPines.length, currentPage, totalPages])

  const paginatedPines = filteredPines.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setSelectedPins([])
  }, [currentPage, searchTerm])

  const copyCurrentPageCodes = () => {
    if (paginatedPines.length === 0) return
    const codes = paginatedPines.map(p => p.codigo).join('\n')
    navigator.clipboard.writeText(codes).then(() => {
      setAlertModal({ type: 'success', message: 'Códigos de esta página copiados al portapapeles.' })
    })
  }

  const toggleSelectAll = () => {
    if (paginatedPines.length === 0) return
    if (selectedPins.length === paginatedPines.length) {
      setSelectedPins([])
    } else {
      setSelectedPins(paginatedPines.map(p => p.id))
    }
  }

  const toggleSelectPin = (id) => {
    setSelectedPins(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    )
  }

  const copySelectedCodes = () => {
    if (selectedPins.length === 0) return
    const codes = pines.filter(p => selectedPins.includes(p.id)).map(p => p.codigo).join('\n')
    navigator.clipboard.writeText(codes).then(() => {
      setAlertModal({ type: 'success', message: `${selectedPins.length} códigos copiados al portapapeles.` })
      setSelectedPins([])
    })
  }

  const deleteSelectedPins = () => {
    if (selectedPins.length === 0) return
    setAlertModal({
      type: 'warning',
      message: `¿Estás seguro de que deseas eliminar ${selectedPins.length} pin(es) seleccionado(s)?`,
      confirm: true,
      onConfirm: async () => {
        setAlertModal(null)
        setLoading(true)
        const { error } = await supabase.from('pines').delete().in('id', selectedPins)
        if (!error) {
          setSelectedPins([])
          fetchPines()
        } else {
          setAlertModal({ type: 'error', message: "Error al eliminar: " + error.message })
          setLoading(false)
        }
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
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card)', padding: '0 16px', borderRadius: '12px', height: '48px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>⏱ Espera entre canjes:</span>
              <input 
                type="number" 
                min="0"
                value={cooldownMins}
                onChange={e => handleUpdateCooldown(e.target.value, cooldownSegsRest)}
                disabled={savingConfig}
                title="Minutos"
                style={{ width: '44px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '16px', outline: 'none', textAlign: 'center' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>min</span>
              <input 
                type="number" 
                min="0"
                max="59"
                value={cooldownSegsRest}
                onChange={e => handleUpdateCooldown(cooldownMins, e.target.value)}
                disabled={savingConfig}
                title="Segundos"
                style={{ width: '44px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#a855f7', fontWeight: 'bold', fontSize: '16px', outline: 'none', textAlign: 'center' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>seg</span>
              {savingConfig && <span style={{ fontSize: '12px', color: 'var(--accent-warning)' }}>...</span>}
            </div>
            <input 
              type="text" 
              placeholder="Buscar por código, nombre o email..." 
              className="input-field"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ minWidth: '320px', height: '48px', borderRadius: '12px', background: 'var(--bg-card)' }}
            />
            {selectedPins.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={copySelectedCodes}>
                  📋 Copiar ({selectedPins.length})
                </button>
                <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={deleteSelectedPins}>
                  🗑️ Eliminar ({selectedPins.length})
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={openNewModal}>
                + Generar Pines
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando pines...</div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Código 
                    <button 
                      onClick={copyCurrentPageCodes} 
                      title="Copiar todos los códigos de esta página"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      📋
                    </button>
                  </th>
                  <th>Monto</th>
                  <th>Moneda</th>
                  <th>Estado</th>
                  <th>Creado el</th>
                  <th>Canjeado por</th>
                  <th>Acciones</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={toggleSelectAll} 
                      checked={paginatedPines.length > 0 && selectedPins.length === paginatedPines.length}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPines.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron pines.</td>
                  </tr>
                ) : (
                  paginatedPines.map(p => (
                    <tr key={p.id}>
                      <td>
                        <span 
                          className="badge" 
                          style={{ fontSize: '14px', background: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0, 210, 255, 0.3)', letterSpacing: '1px', cursor: 'pointer' }}
                          onClick={() => copyToClipboard(p.codigo)}
                          title="Clic para copiar"
                        >
                          {p.codigo}
                        </span>
                      </td>
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
                            <div 
                              style={{ color: 'var(--accent-primary)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => p.canjeado_por_user && setSelectedUser(p.canjeado_por_user)}
                              title="Ver información del usuario"
                            >
                              {p.canjeado_por_user?.nombres || p.canjeado_por_user?.apellidos 
                                ? `${p.canjeado_por_user.nombres || ''} ${p.canjeado_por_user.apellidos || ''}`.trim()
                                : p.canjeado_por_user?.email || 'Usuario Anónimo'}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                              {new Date(p.canjeado_en).toLocaleDateString()} {new Date(p.canjeado_en).toLocaleTimeString()}
                            </div>
                            {p.transaccion_id && (
                              <div style={{ color: 'var(--accent-primary)', fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>
                                Tx: #{p.transaccion_id.substring(0, 8)}
                              </div>
                            )}
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
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedPins.includes(p.id)} 
                          onChange={() => toggleSelectPin(p.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Controles de Paginación */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
            <button 
              className="btn"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '12px' }}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 'bold' }}>
              Página <span style={{ color: 'var(--text-primary)' }}>{currentPage}</span> de <span style={{ color: 'var(--text-primary)' }}>{totalPages}</span>
            </div>
            <button 
              className="btn"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '12px' }}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        )}

        {/* Modal Información de Usuario */}
        {selectedUser && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1000 }} onClick={() => setSelectedUser(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              maxWidth: '450px', 
              width: '95%', 
              padding: '30px', 
              borderRadius: '24px', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)' 
            }}>
              <div className="modal-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Perfil de Usuario</h3>
                <button className="btn-close" style={{ fontSize: '24px', width: '32px', height: '32px' }} onClick={() => setSelectedUser(null)}>×</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                    {(selectedUser.nombres?.[0] || selectedUser.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      {selectedUser.nombres || selectedUser.apellidos ? `${selectedUser.nombres || ''} ${selectedUser.apellidos || ''}`.trim() : 'Sin nombre completo'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                      {selectedUser.rol || 'Cliente'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Email</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', wordBreak: 'break-all' }}>{selectedUser.email || '-'}</div>
                  </div>
                  <div style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Teléfono</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{selectedUser.telefono || '-'}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Ubicación</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    {selectedUser.ciudad || selectedUser.pais ? `${selectedUser.ciudad || ''}${selectedUser.ciudad && selectedUser.pais ? ', ' : ''}${selectedUser.pais || ''}` : '-'}
                  </div>
                </div>
              </div>
              
            </div>
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
