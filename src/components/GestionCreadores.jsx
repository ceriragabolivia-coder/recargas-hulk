import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import FloatingBackground from './FloatingBackground'
import { hasRole } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function GestionCreadores() {
  const { perfil } = useAuth()
  const isAdmin = hasRole(perfil, 'admin', 'administrador', 'superadmin')
  const [codigos, setCodigos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    codigo: '',
    creador_nombre: '',
    porcentaje_descuento: '',
    limite_global: '',
    compras_con_descuento_por_usuario: '1',
    usuario_id: null
  })

  const [assignData, setAssignData] = useState({
    searchEmail: '',
    searchResults: [],
    isSearching: false,
    selectedUser: null
  })

  const [usersListModal, setUsersListModal] = useState(false)
  const [loadingUsersList, setLoadingUsersList] = useState(false)
  const [registeredUsersList, setRegisteredUsersList] = useState([])
  const [selectedCodeForUsers, setSelectedCodeForUsers] = useState(null)

  const [userOrdersModal, setUserOrdersModal] = useState(false)
  const [userWalletModal, setUserWalletModal] = useState(false)
  const [userOrdersList, setUserOrdersList] = useState([])
  const [userWalletList, setUserWalletList] = useState([])
  const [loadingUserHistory, setLoadingUserHistory] = useState(false)
  const [selectedUserHistory, setSelectedUserHistory] = useState(null)

  // Estados para el Sistema de Recompensas
  const [showObjetivosModal, setShowObjetivosModal] = useState(false)
  const [isGlobalObjective, setIsGlobalObjective] = useState(true)
  const [selectedCodigoParaObjetivos, setSelectedCodigoParaObjetivos] = useState(null)
  const [objetivosList, setObjetivosList] = useState([])
  const [loadingObjetivos, setLoadingObjetivos] = useState(false)
  
  const [juegos, setJuegos] = useState([])
  const [productos, setProductos] = useState([])
  const [selectedJuego1, setSelectedJuego1] = useState('')
  const [selectedJuego2, setSelectedJuego2] = useState('')
  const [selectedJuego3, setSelectedJuego3] = useState('')

  const [newObjetivoData, setNewObjetivoData] = useState({
    meta_registros: '',
    producto_1_id: '',
    producto_2_id: '',
    producto_3_id: ''
  })

  useEffect(() => {
    if (isAdmin) {
      fetchCodigos()
      fetchJuegosYProductos()
    }
  }, [isAdmin])

  const fetchJuegosYProductos = async () => {
    const { data: jData } = await supabase.from('juegos').select('id, nombre').eq('activo', true).order('nombre')
    const { data: pData } = await supabase.from('productos').select('id, nombre, juego_id, icono_url').eq('activo', true).order('orden')
    if (jData) setJuegos(jData)
    if (pData) setProductos(pData)
  }

  const fetchCodigos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('codigos_creadores')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) setCodigos(data)
    setLoading(false)
  }

  const openNewModal = () => {
    setEditingId(null)
    setFormData({
      codigo: '',
      creador_nombre: '',
      porcentaje_descuento: '',
      limite_global: '',
      compras_con_descuento_por_usuario: '1',
      usuario_id: null
    })
    setAssignData({ searchEmail: '', searchResults: [], isSearching: false, selectedUser: null })
    setShowModal(true)
  }

  const openEditModal = async (c) => {
    setEditingId(c.id)
    setFormData({
      codigo: c.codigo,
      creador_nombre: c.creador_nombre,
      porcentaje_descuento: c.porcentaje_descuento,
      limite_global: c.limite_global || '',
      compras_con_descuento_por_usuario: c.compras_con_descuento_por_usuario || '1',
      usuario_id: c.usuario_id || null
    })
    
    let userDetails = null;
    if (c.usuario_id) {
       const { data } = await supabase.from('clientes').select('id, auth_user_id, nombres, apellidos, nickname, usuario').eq('auth_user_id', c.usuario_id).single()
       if (data) userDetails = data;
    }
    
    setAssignData({ searchEmail: '', searchResults: [], isSearching: false, selectedUser: userDetails })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.codigo || !formData.porcentaje_descuento || !formData.creador_nombre) {
      setAlertModal({ type: 'warning', message: 'El código, el nombre y el porcentaje son obligatorios' })
      return
    }
    
    const payload = {
      codigo: formData.codigo.toUpperCase().replace(/\s+/g, ''),
      creador_nombre: formData.creador_nombre,
      porcentaje_descuento: parseFloat(formData.porcentaje_descuento),
      limite_global: formData.limite_global ? parseInt(formData.limite_global) : 0,
      compras_con_descuento_por_usuario: formData.compras_con_descuento_por_usuario ? parseInt(formData.compras_con_descuento_por_usuario) : 1,
      usuario_id: assignData.selectedUser ? assignData.selectedUser.auth_user_id : null
    }

    let error;
    if (editingId) {
      const { error: updateError } = await supabase.from('codigos_creadores').update(payload).eq('id', editingId)
      error = updateError
    } else {
      const { error: insertError } = await supabase.from('codigos_creadores').insert([payload])
      error = insertError
    }
    
    if (error) {
      setAlertModal({ type: 'error', message: `Error al ${editingId ? 'actualizar' : 'crear'} el código de creador: ` + error.message })
    } else {
      setAlertModal({ type: 'success', message: `Código ${editingId ? 'actualizado' : 'creado'} exitosamente` })
      setShowModal(false)
      setEditingId(null)
      fetchCodigos()
    }
  }

  const searchUser = async (emailOrNickname) => {
    if (!emailOrNickname || emailOrNickname.length < 3) return
    setAssignData(prev => ({ ...prev, isSearching: true }))
    
    const { data: usersData } = await supabase
      .from('clientes')
      .select('id, auth_user_id, nombres, apellidos, nickname, usuario')
      .or(`usuario.ilike.%${emailOrNickname}%,nickname.ilike.%${emailOrNickname}%`)
      .limit(10)
      
    setAssignData(prev => ({ ...prev, searchResults: usersData || [], isSearching: false }))
  }

  const toggleStatus = async (id, currentStatus) => {
    const { error } = await supabase.from('codigos_creadores').update({ activo: !currentStatus }).eq('id', id)
    if (!error) fetchCodigos()
  }
  
  const deleteCodigo = (id) => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Código de Creador',
      message: '¿Estás seguro de eliminar este código? Se perderá el seguimiento de este creador.',
      onConfirm: async () => {
        setAlertModal(null)
        const { error } = await supabase.from('codigos_creadores').delete().eq('id', id)
        if (!error) fetchCodigos()
        else setAlertModal({ type: 'error', message: "Error al eliminar: " + error.message })
      }
    })
  }

  const handleViewRegisteredUsers = async (codigoObj) => {
    setSelectedCodeForUsers(codigoObj)
    setUsersListModal(true)
    setLoadingUsersList(true)
    
    const { data, error } = await supabase
      .from('clientes')
      .select('id, auth_user_id, nombres, apellidos, nickname, usuario, fecha_registro, estado')
      .eq('creador_codigo_id', codigoObj.id)
      .order('fecha_registro', { ascending: false })
      
    if (data) {
      setRegisteredUsersList(data)
    } else {
      setRegisteredUsersList([])
    }
    setLoadingUsersList(false)
  }

  const openUserOrders = async (user) => {
    if (!user.auth_user_id) return
    setSelectedUserHistory(user)
    setUserOrdersModal(true)
    setLoadingUserHistory(true)
    
    const { data } = await supabase
      .from('pedidos')
      .select('id, total_usd, total_bs, estado, created_at')
      .eq('auth_user_id', user.auth_user_id)
      .order('created_at', { ascending: false })
      
    setUserOrdersList(data || [])
    setLoadingUserHistory(false)
  }

  const openUserWallet = async (user) => {
    if (!user.auth_user_id) return
    setSelectedUserHistory(user)
    setUserWalletModal(true)
    setLoadingUserHistory(true)
    
    const { data } = await supabase
      .from('billetera_recargas')
      .select('id, monto, moneda, estado, created_at, metodos_pago(nombre)')
      .eq('auth_user_id', user.auth_user_id)
      .order('created_at', { ascending: false })
      
    setUserWalletList(data || [])
    setLoadingUserHistory(false)
  }

  // --- REWARDS SYSTEM METHODS ---
  const openObjetivosGlobales = () => {
    setIsGlobalObjective(true)
    setSelectedCodigoParaObjetivos(null)
    setShowObjetivosModal(true)
    fetchObjetivos(null)
    resetNewObjetivo()
  }

  const openObjetivosIndividuales = (c) => {
    setIsGlobalObjective(false)
    setSelectedCodigoParaObjetivos(c)
    setShowObjetivosModal(true)
    fetchObjetivos(c.id)
    resetNewObjetivo()
  }

  const resetNewObjetivo = () => {
    setNewObjetivoData({ 
      meta_registros: '', compras_minimas_usuario: '0', 
      recompensa_1_tipo: 'producto', recompensa_1_valor: '', producto_1_id: '', 
      recompensa_2_tipo: 'producto', recompensa_2_valor: '', producto_2_id: '', 
      recompensa_3_tipo: 'producto', recompensa_3_valor: '', producto_3_id: '' 
    })
    setSelectedJuego1('')
    setSelectedJuego2('')
    setSelectedJuego3('')
  }

  const fetchObjetivos = async (codigoId) => {
    setLoadingObjetivos(true)
    let query = supabase.from('creador_objetivos').select(`
      *,
      p1:producto_1_id(id, nombre, juego_id, icono_url),
      p2:producto_2_id(id, nombre, juego_id, icono_url),
      p3:producto_3_id(id, nombre, juego_id, icono_url)
    `)
    
    if (codigoId) {
      query = query.eq('codigo_id', codigoId)
    } else {
      query = query.is('codigo_id', null)
    }
    
    const { data, error } = await query.order('meta_registros', { ascending: true })
    if (data) setObjetivosList(data)
    if (error) console.error(error)
    setLoadingObjetivos(false)
  }

  const saveObjetivo = async () => {
    if (!newObjetivoData.meta_registros) {
      setAlertModal({ type: 'warning', message: 'La meta de registros es obligatoria.' })
      return
    }
    
    if (newObjetivoData.recompensa_1_tipo === 'producto' && !newObjetivoData.producto_1_id) {
       setAlertModal({ type: 'warning', message: 'Debe seleccionar un producto para la recompensa 1.' })
       return
    }
    
    if (newObjetivoData.recompensa_1_tipo !== 'producto' && (!newObjetivoData.recompensa_1_valor || parseFloat(newObjetivoData.recompensa_1_valor) <= 0)) {
       setAlertModal({ type: 'warning', message: 'Debe especificar un valor válido para la recompensa de saldo.' })
       return
    }
    
    const payload = {
      codigo_id: isGlobalObjective ? null : selectedCodigoParaObjetivos.id,
      meta_registros: parseInt(newObjetivoData.meta_registros),
      compras_minimas_usuario: parseInt(newObjetivoData.compras_minimas_usuario) || 0,
      
      recompensa_1_tipo: newObjetivoData.recompensa_1_tipo,
      recompensa_1_valor: newObjetivoData.recompensa_1_tipo !== 'producto' ? parseFloat(newObjetivoData.recompensa_1_valor) : 0,
      producto_1_id: newObjetivoData.recompensa_1_tipo === 'producto' ? newObjetivoData.producto_1_id : null,
      
      recompensa_2_tipo: newObjetivoData.recompensa_2_tipo,
      recompensa_2_valor: newObjetivoData.recompensa_2_tipo !== 'producto' && newObjetivoData.recompensa_2_valor ? parseFloat(newObjetivoData.recompensa_2_valor) : 0,
      producto_2_id: newObjetivoData.recompensa_2_tipo === 'producto' ? (newObjetivoData.producto_2_id || null) : null,
      
      recompensa_3_tipo: newObjetivoData.recompensa_3_tipo,
      recompensa_3_valor: newObjetivoData.recompensa_3_tipo !== 'producto' && newObjetivoData.recompensa_3_valor ? parseFloat(newObjetivoData.recompensa_3_valor) : 0,
      producto_3_id: newObjetivoData.recompensa_3_tipo === 'producto' ? (newObjetivoData.producto_3_id || null) : null
    }

    const { error } = await supabase.from('creador_objetivos').insert([payload])
    if (error) {
      setAlertModal({ type: 'error', message: 'Error al guardar el objetivo: ' + error.message })
    } else {
      fetchObjetivos(isGlobalObjective ? null : selectedCodigoParaObjetivos.id)
      resetNewObjetivo()
    }
  }

  const deleteObjetivo = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este objetivo?')) return
    const { error } = await supabase.from('creador_objetivos').delete().eq('id', id)
    if (error) {
      setAlertModal({ type: 'error', message: 'Error al eliminar: ' + error.message })
    } else {
      fetchObjetivos(isGlobalObjective ? null : selectedCodigoParaObjetivos.id)
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
            <h2 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Códigos de Creadores 🌟</h2>
            <p style={{ color: 'var(--text-muted)' }}>Crea y administra códigos de referidos para creadores de contenido</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={openObjetivosGlobales} style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none', fontWeight: 'bold' }}>
              🏆 Objetivos Globales
            </button>
            <button className="btn btn-primary" onClick={openNewModal}>
              + Nuevo Código
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando códigos...</div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Creador</th>
                  <th>Descuento</th>
                  <th>Compras Efectuadas</th>
                  <th>Límite Global</th>
                  <th>Compras por Usuario</th>
                  <th>Referidos (Registros)</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {codigos.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{c.codigo}</td>
                    <td>{c.creador_nombre}</td>
                    <td style={{ color: '#38ef7d', fontWeight: 'bold' }}>{c.porcentaje_descuento}%</td>
                    <td>{c.usos_totales} {c.limite_global > 0 ? `/ ${c.limite_global}` : ''}</td>
                    <td>{c.limite_global > 0 ? c.limite_global : 'Ilimitado'}</td>
                    <td>{c.compras_con_descuento_por_usuario} compra(s)</td>
                    <td>
                      <span 
                        onClick={() => handleViewRegisteredUsers(c)}
                        style={{ background: 'rgba(255, 215, 0, 0.2)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', color: '#FFD700', cursor: 'pointer', transition: 'all 0.2s ease', display: 'inline-block' }}
                        onMouseOver={(e) => e.target.style.background = 'rgba(255, 215, 0, 0.4)'}
                        onMouseOut={(e) => e.target.style.background = 'rgba(255, 215, 0, 0.2)'}
                        title="Ver usuarios registrados"
                      >
                        {c.usuarios_registrados}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => toggleStatus(c.id, c.activo)}
                        style={{
                          padding: '4px 12px', borderRadius: '12px', border: 'none',
                          backgroundColor: c.activo ? 'rgba(56, 239, 125, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: c.activo ? '#38ef7d' : '#ef4444',
                          cursor: 'pointer', fontWeight: 600, fontSize: '12px'
                        }}
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openObjetivosIndividuales(c)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }} title="Metas/Premios Individuales">🏆</button>
                        <button onClick={() => openEditModal(c)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} title="Editar Código">✏️</button>
                        <button onClick={() => deleteCodigo(c.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)' }} title="Eliminar Código">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {codigos.length === 0 && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay códigos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

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
              <h3 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                {editingId ? 'Editar Código' : 'Nuevo Código de Creador'}
              </h3>
              <button className="btn-close" style={{ fontSize: '28px', width: '40px', height: '40px' }} onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-primary)' }}>Nombre del Creador (Referencia) *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={formData.creador_nombre}
                      onChange={e => setFormData({...formData, creador_nombre: e.target.value})}
                      required
                      placeholder="Ej. ElXokas, Ibai, etc"
                      style={{ height: '56px', fontSize: '18px', fontWeight: 800, textAlign: 'center' }}
                    />
                  </div>
                  
                  <div className="form-group" style={{ flex: 2 }}>
                    <label style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-primary)' }}>🎟️ Código Promocional *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={formData.codigo}
                      onChange={e => setFormData({...formData, codigo: e.target.value.toUpperCase()})}
                      required
                      placeholder="Ej. HULK-10"
                      style={{ height: '56px', fontSize: '18px', fontWeight: 800, letterSpacing: '2px', textAlign: 'center', textTransform: 'uppercase' }}
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--accent-success)' }}>💰 Descuento (%) *</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={formData.porcentaje_descuento}
                      onChange={e => setFormData({...formData, porcentaje_descuento: e.target.value})}
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="10"
                      style={{ height: '56px', fontSize: '22px', fontWeight: 900, textAlign: 'center', color: 'var(--accent-success)' }}
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'flex', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>🌎 Límite Global de Usos</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={formData.limite_global}
                      onChange={e => setFormData({...formData, limite_global: e.target.value})}
                      min="0"
                      placeholder="Dejar vacío para ilimitado"
                      style={{ height: '48px', fontSize: '16px' }}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Total de veces que se puede usar en toda la web.</small>
                  </div>
                  
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>👤 Compras con descuento por referido</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={formData.compras_con_descuento_por_usuario}
                      onChange={e => setFormData({...formData, compras_con_descuento_por_usuario: e.target.value})}
                      min="1"
                      placeholder="Ej. 1"
                      style={{ height: '48px', fontSize: '16px' }}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Ej: Si pones 3, el descuento aplica a la 1ra, 2da y 3ra compra del referido.</small>
                  </div>
                </div>

                <div className="form-row" style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '15px' }}>👤 Vincular a Usuario Web (Opcional)</h4>
                  
                  {!assignData.selectedUser ? (
                    <div className="form-group">
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={assignData.searchEmail} 
                          onChange={e => setAssignData({...assignData, searchEmail: e.target.value})}
                          placeholder="Buscar por Email o Nickname..."
                          style={{ height: '48px' }}
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => searchUser(assignData.searchEmail)}
                          style={{ height: '48px', padding: '0 20px' }}
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
                                {(u.nombres || u.nickname || u.usuario || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 'bold' }}>{u.nombres} {u.apellidos} {u.nickname ? `(${u.nickname})` : ''}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.usuario}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="form-group">
                      <div style={{ padding: '12px', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(0, 210, 255, 0.3)' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{assignData.selectedUser.nombres} {assignData.selectedUser.nickname ? `(${assignData.selectedUser.nickname})` : ''}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{assignData.selectedUser.usuario}</div>
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-ghost btn-sm"
                          onClick={() => setAssignData({...assignData, selectedUser: null})}
                        >
                          Cambiar
                        </button>
                      </div>
                      <small style={{ color: 'var(--accent-primary)', fontSize: '12px', marginTop: '8px', display: 'block' }}>Este usuario podrá ver las estadísticas de este código en su perfil.</small>
                    </div>
                  )}
                </div>

                <div className="form-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '16px', padding: '0 24px' }} onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: '16px', fontWeight: 800, padding: '0 32px', height: '52px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0088ff 100%)', borderRadius: '14px' }}>
                    {editingId ? 'Actualizar Código' : 'Crear Código'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {usersListModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1000 }} onClick={() => setUsersListModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '650px', width: '95%', padding: '40px', borderRadius: '28px', 
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div className="modal-header" style={{ marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Referidos de {selectedCodeForUsers?.codigo}
              </h3>
              <p style={{ color: 'var(--text-muted)', margin: '8px 0 0 0', fontSize: '14px' }}>
                Usuarios registrados utilizando el código de {selectedCodeForUsers?.creador_nombre}
              </p>
              <button className="btn-close" style={{ fontSize: '28px', width: '40px', height: '40px', position: 'absolute', top: '24px', right: '24px' }} onClick={() => setUsersListModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {loadingUsersList ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando usuarios...</div>
              ) : registeredUsersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay usuarios registrados con este código.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {registeredUsersList.map(u => (
                    <div key={u.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                          {(u.nombres || u.nickname || u.usuario || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{u.nombres} {u.apellidos} {u.nickname ? `(${u.nickname})` : ''}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.usuario}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Registrado: {new Date(u.fecha_registro).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: u.estado === 'aprobado' ? 'rgba(56, 239, 125, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: u.estado === 'aprobado' ? '#38ef7d' : '#f59e0b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {u.estado}
                        </div>
                        {u.auth_user_id && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => openUserOrders(u)}
                              title="Ver Movimientos (Pedidos)"
                            >
                              🛒 Movimientos
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => openUserWallet(u)}
                              title="Ver Recargas de Billetera"
                            >
                              🏦 Billetera
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIDOS DEL USUARIO */}
      {userOrdersModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1100 }} onClick={() => setUserOrdersModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '600px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            <div className="modal-header" style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Movimientos de {selectedUserHistory?.nombres}
              </h3>
              <button className="btn-close" style={{ fontSize: '24px', width: '32px', height: '32px', position: 'absolute', top: '24px', right: '24px' }} onClick={() => setUserOrdersModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {loadingUserHistory ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Cargando movimientos...</div>
              ) : userOrdersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Este usuario no ha realizado pedidos.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {userOrdersList.map(o => (
                    <div key={o.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Pedido #{o.id.split('-')[0]}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-success)' }}>
                          ${o.total_usd ? parseFloat(o.total_usd).toFixed(2) : '0.00'}
                        </div>
                        <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', textTransform: 'uppercase' }}>
                          {o.estado}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL BILLETERA DEL USUARIO */}
      {userWalletModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1100 }} onClick={() => setUserWalletModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '600px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            <div className="modal-header" style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Billetera de {selectedUserHistory?.nombres}
              </h3>
              <button className="btn-close" style={{ fontSize: '24px', width: '32px', height: '32px', position: 'absolute', top: '24px', right: '24px' }} onClick={() => setUserWalletModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {loadingUserHistory ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Cargando recargas...</div>
              ) : userWalletList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Este usuario no tiene recargas en su billetera.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {userWalletList.map(r => (
                    <div key={r.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.metodos_pago?.nombre || 'Recarga'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: r.moneda === 'bs' ? '#a855f7' : 'var(--accent-success)' }}>
                          {r.moneda === 'bs' ? `Bs ${parseFloat(r.monto).toFixed(2)}` : `$${parseFloat(r.monto).toFixed(2)}`}
                        </div>
                        <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', textTransform: 'uppercase' }}>
                          {r.estado}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL OBJETIVOS Y PREMIOS */}
      {showObjetivosModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1100 }} onClick={() => setShowObjetivosModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '800px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div className="modal-header" style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                {isGlobalObjective ? '🏆 Objetivos Globales' : `🏆 Objetivos para ${selectedCodigoParaObjetivos?.codigo}`}
              </h3>
              <p style={{ color: 'var(--text-muted)', margin: '8px 0 0 0', fontSize: '14px' }}>
                {isGlobalObjective ? 'Estos premios se otorgarán a TODOS los creadores cuando alcancen estas metas.' : 'Estos premios son exclusivos para este creador al alcanzar sus metas.'}
              </p>
              <button className="btn-close" style={{ fontSize: '24px', width: '32px', height: '32px', position: 'absolute', top: '24px', right: '24px' }} onClick={() => setShowObjetivosModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Add New Objective Form */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--accent-primary)' }}>✨ Crear Nuevo Objetivo</h4>
                
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Cantidad de Referidos Requerida *</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={newObjetivoData.meta_registros}
                      onChange={e => setNewObjetivoData({...newObjetivoData, meta_registros: e.target.value})}
                      placeholder="Ej: 50"
                      min="1"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Compras exitosas mínimas por usuario</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={newObjetivoData.compras_minimas_usuario}
                      onChange={e => setNewObjetivoData({...newObjetivoData, compras_minimas_usuario: e.target.value})}
                      placeholder="Ej: 1 (0 = todos valen)"
                      min="0"
                    />
                  </div>
                </div>

                {/* Recompensa 1 */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: '#38ef7d', marginBottom: '4px', display: 'block' }}>🎁 Recompensa 1 (Obligatorio)</label>
                    <select 
                      className="input-field" 
                      value={newObjetivoData.recompensa_1_tipo}
                      onChange={e => setNewObjetivoData({...newObjetivoData, recompensa_1_tipo: e.target.value})}
                      style={{ marginBottom: '8px' }}
                    >
                      <option value="producto">Producto</option>
                      <option value="saldo_usd">Saldo a la billetera (USD)</option>
                      <option value="saldo_bs">Saldo a la billetera (Bs)</option>
                    </select>
                    
                    {newObjetivoData.recompensa_1_tipo === 'producto' ? (
                      <>
                        <select 
                          className="input-field" 
                          value={selectedJuego1}
                          onChange={e => { setSelectedJuego1(e.target.value); setNewObjetivoData({...newObjetivoData, producto_1_id: ''}) }}
                          style={{ marginBottom: '8px' }}
                        >
                          <option value="">Selecciona un Juego/Servicio...</option>
                          {juegos.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                        </select>
                        {selectedJuego1 && (
                          <select 
                            className="input-field" 
                            value={newObjetivoData.producto_1_id}
                            onChange={e => setNewObjetivoData({...newObjetivoData, producto_1_id: e.target.value})}
                          >
                            <option value="">Selecciona el Producto...</option>
                            {productos.filter(p => p.juego_id == selectedJuego1).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        )}
                      </>
                    ) : (
                      <input 
                        type="number" 
                        className="input-field" 
                        value={newObjetivoData.recompensa_1_valor}
                        onChange={e => setNewObjetivoData({...newObjetivoData, recompensa_1_valor: e.target.value})}
                        placeholder={`Monto en ${newObjetivoData.recompensa_1_tipo === 'saldo_usd' ? 'USD ($)' : 'Bs'}`}
                        min="0"
                        step="0.01"
                      />
                    )}
                  </div>
                </div>

                {/* Recompensa 2 */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>🎁 Recompensa 2 (Opcional)</label>
                    <select 
                      className="input-field" 
                      value={newObjetivoData.recompensa_2_tipo}
                      onChange={e => setNewObjetivoData({...newObjetivoData, recompensa_2_tipo: e.target.value})}
                      style={{ marginBottom: '8px' }}
                    >
                      <option value="producto">Producto</option>
                      <option value="saldo_usd">Saldo a la billetera (USD)</option>
                      <option value="saldo_bs">Saldo a la billetera (Bs)</option>
                    </select>
                    
                    {newObjetivoData.recompensa_2_tipo === 'producto' ? (
                      <>
                        <select 
                          className="input-field" 
                          value={selectedJuego2}
                          onChange={e => { setSelectedJuego2(e.target.value); setNewObjetivoData({...newObjetivoData, producto_2_id: ''}) }}
                          style={{ marginBottom: '8px' }}
                        >
                          <option value="">Selecciona un Juego/Servicio...</option>
                          {juegos.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                        </select>
                        {selectedJuego2 && (
                          <select 
                            className="input-field" 
                            value={newObjetivoData.producto_2_id}
                            onChange={e => setNewObjetivoData({...newObjetivoData, producto_2_id: e.target.value})}
                          >
                            <option value="">Selecciona el Producto...</option>
                            {productos.filter(p => p.juego_id == selectedJuego2).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        )}
                      </>
                    ) : (
                      <input 
                        type="number" 
                        className="input-field" 
                        value={newObjetivoData.recompensa_2_valor}
                        onChange={e => setNewObjetivoData({...newObjetivoData, recompensa_2_valor: e.target.value})}
                        placeholder={`Monto en ${newObjetivoData.recompensa_2_tipo === 'saldo_usd' ? 'USD ($)' : 'Bs'}`}
                        min="0"
                        step="0.01"
                      />
                    )}
                  </div>
                </div>

                {/* Recompensa 3 */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>🎁 Recompensa 3 (Opcional)</label>
                    <select 
                      className="input-field" 
                      value={newObjetivoData.recompensa_3_tipo}
                      onChange={e => setNewObjetivoData({...newObjetivoData, recompensa_3_tipo: e.target.value})}
                      style={{ marginBottom: '8px' }}
                    >
                      <option value="producto">Producto</option>
                      <option value="saldo_usd">Saldo a la billetera (USD)</option>
                      <option value="saldo_bs">Saldo a la billetera (Bs)</option>
                    </select>
                    
                    {newObjetivoData.recompensa_3_tipo === 'producto' ? (
                      <>
                        <select 
                          className="input-field" 
                          value={selectedJuego3}
                          onChange={e => { setSelectedJuego3(e.target.value); setNewObjetivoData({...newObjetivoData, producto_3_id: ''}) }}
                          style={{ marginBottom: '8px' }}
                        >
                          <option value="">Selecciona un Juego/Servicio...</option>
                          {juegos.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                        </select>
                        {selectedJuego3 && (
                          <select 
                            className="input-field" 
                            value={newObjetivoData.producto_3_id}
                            onChange={e => setNewObjetivoData({...newObjetivoData, producto_3_id: e.target.value})}
                          >
                            <option value="">Selecciona el Producto...</option>
                            {productos.filter(p => p.juego_id == selectedJuego3).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        )}
                      </>
                    ) : (
                      <input 
                        type="number" 
                        className="input-field" 
                        value={newObjetivoData.recompensa_3_valor}
                        onChange={e => setNewObjetivoData({...newObjetivoData, recompensa_3_valor: e.target.value})}
                        placeholder={`Monto en ${newObjetivoData.recompensa_3_tipo === 'saldo_usd' ? 'USD ($)' : 'Bs'}`}
                        min="0"
                        step="0.01"
                      />
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary" onClick={saveObjetivo}>+ Agregar Objetivo</button>
                </div>
              </div>

              {/* List of current objectives */}
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Objetivos Configurados</h4>
                {loadingObjetivos ? (
                  <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
                ) : objetivosList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay objetivos configurados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {objetivosList.map(obj => (
                      <div key={obj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFD700', marginBottom: '8px' }}>
                            Meta: {obj.meta_registros} referidos {obj.compras_minimas_usuario > 0 ? `(con min. ${obj.compras_minimas_usuario} compras)` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {obj.recompensa_1_tipo === 'producto' && obj.p1 && <div style={{ fontSize: '12px', background: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', padding: '4px 10px', borderRadius: '12px' }}>🎁 {obj.p1.nombre}</div>}
                            {obj.recompensa_1_tipo === 'saldo_usd' && <div style={{ fontSize: '12px', background: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', padding: '4px 10px', borderRadius: '12px' }}>🎁 ${obj.recompensa_1_valor} USD</div>}
                            {obj.recompensa_1_tipo === 'saldo_bs' && <div style={{ fontSize: '12px', background: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', padding: '4px 10px', borderRadius: '12px' }}>🎁 {obj.recompensa_1_valor} Bs</div>}
                            
                            {((obj.recompensa_2_tipo === 'producto' && obj.p2) || (obj.recompensa_2_tipo !== 'producto' && obj.recompensa_2_valor > 0)) && (
                              <div style={{ fontSize: '12px', background: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', padding: '4px 10px', borderRadius: '12px' }}>
                                {obj.recompensa_2_tipo === 'producto' ? `🎁 ${obj.p2?.nombre}` : obj.recompensa_2_tipo === 'saldo_usd' ? `🎁 $${obj.recompensa_2_valor} USD` : `🎁 ${obj.recompensa_2_valor} Bs`}
                              </div>
                            )}
                            
                            {((obj.recompensa_3_tipo === 'producto' && obj.p3) || (obj.recompensa_3_tipo !== 'producto' && obj.recompensa_3_valor > 0)) && (
                              <div style={{ fontSize: '12px', background: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', padding: '4px 10px', borderRadius: '12px' }}>
                                {obj.recompensa_3_tipo === 'producto' ? `🎁 ${obj.p3?.nombre}` : obj.recompensa_3_tipo === 'saldo_usd' ? `🎁 $${obj.recompensa_3_valor} USD` : `🎁 ${obj.recompensa_3_valor} Bs`}
                              </div>
                            )}
                          </div>
                        </div>
                        <button className="btn btn-secondary" onClick={() => deleteObjetivo(obj.id)} style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none' }}>Eliminar</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <AlertModal 
          type={alertModal.type} 
          title={alertModal.title}
          message={alertModal.message} 
          onClose={() => setAlertModal(null)} 
          onConfirm={alertModal.onConfirm}
        />
      )}
    </div>
  )
}
