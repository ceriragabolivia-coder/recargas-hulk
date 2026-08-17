import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'
import FloatingBackground from './FloatingBackground'
import { hasRole } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function GestionReferidos() {
  const { perfil } = useAuth()
  const isAdmin = hasRole(perfil, 'admin', 'administrador', 'superadmin')
  
  const [objetivos, setObjetivos] = useState([])
  const [topReferidores, setTopReferidores] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showModal, setShowModal] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  
  const [productos, setProductos] = useState([])
  const [juegos, setJuegos] = useState([])
  const [selectedJuego, setSelectedJuego] = useState('')

  const [formData, setFormData] = useState({
    meta_registros_activos: '',
    compras_minimas_usuario: '1',
    recompensa_tipo: 'saldo_usd', // 'saldo_bs', 'saldo_usd', 'producto'
    recompensa_valor: '' // monto o producto_id
  })

  useEffect(() => {
    if (isAdmin) {
      fetchData()
      fetchJuegosYProductos()
    }
  }, [isAdmin])

  const fetchJuegosYProductos = async () => {
    const { data: jData } = await supabase.from('juegos').select('id, nombre').eq('activo', true).order('nombre')
    const { data: pData } = await supabase.from('productos').select('id, nombre, juego_id').eq('activo', true).order('orden')
    if (jData) setJuegos(jData)
    if (pData) setProductos(pData)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Obtener Objetivos Globales
      const { data: objData } = await supabase
        .from('referidos_objetivos')
        .select('*')
        .order('meta_registros_activos', { ascending: true })
      
      if (objData) setObjetivos(objData)

      // 2. Obtener Top Referidores (Usuarios con más referidos)
      const { data: refData } = await supabase
        .from('clientes')
        .select('referido_por_cliente_id')
        .not('referido_por_cliente_id', 'is', null)

      if (refData) {
        const counts = {}
        refData.forEach(r => {
          counts[r.referido_por_cliente_id] = (counts[r.referido_por_cliente_id] || 0) + 1
        })
        
        const topIds = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0, 10)
        
        if (topIds.length > 0) {
          const { data: userData } = await supabase
            .from('clientes')
            .select('id, nombres, apellidos, usuario, nickname')
            .in('id', topIds)
            
          const topArray = userData.map(u => ({
            ...u,
            totalReferidos: counts[u.id]
          })).sort((a,b) => b.totalReferidos - a.totalReferidos)
          
          setTopReferidores(topArray)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setFormData({
      meta_registros_activos: '',
      compras_minimas_usuario: '1',
      recompensa_tipo: 'saldo_usd',
      recompensa_valor: ''
    })
    setSelectedJuego('')
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.meta_registros_activos || !formData.compras_minimas_usuario || !formData.recompensa_valor) {
      setAlertModal({ type: 'error', title: 'Error', message: 'Por favor completa todos los campos requeridos.' })
      return
    }

    try {
      const payload = {
        meta_registros_activos: parseInt(formData.meta_registros_activos),
        compras_minimas_usuario: parseInt(formData.compras_minimas_usuario),
        recompensa_tipo: formData.recompensa_tipo,
        recompensa_valor: parseFloat(formData.recompensa_valor)
      }

      const { error } = await supabase.from('referidos_objetivos').insert([payload])
      
      if (error) throw error

      setAlertModal({ type: 'success', title: 'Éxito', message: 'Objetivo creado correctamente.' })
      setShowModal(false)
      fetchData()
    } catch (err) {
      setAlertModal({ type: 'error', title: 'Error', message: err.message })
    }
  }

  const toggleEstadoObjetivo = async (id, currentEstado) => {
    try {
      const { error } = await supabase.from('referidos_objetivos').update({ estado: !currentEstado }).eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      setAlertModal({ type: 'error', title: 'Error', message: err.message })
    }
  }

  const deleteObjetivo = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este objetivo?')) return
    try {
      const { error } = await supabase.from('referidos_objetivos').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      setAlertModal({ type: 'error', title: 'Error', message: err.message })
    }
  }

  const renderPremioName = (tipo, valor) => {
    if (tipo === 'saldo_bs') return `${valor} Bs`
    if (tipo === 'saldo_usd') return `$${valor} USD`
    if (tipo === 'producto') {
      const p = productos.find(x => x.id === parseInt(valor))
      return p ? p.nombre : `Producto ID: ${valor}`
    }
    return valor
  }

  if (!isAdmin) return <div className="card" style={{ color: '#fff' }}>No tienes acceso a esta sección.</div>

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh', padding: '20px' }}>
      <FloatingBackground />
      <div style={{ position: 'relative', zIndex: 10 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🤝</span> Sistema de Referidos
          </h2>
          <button className="btn-primary" onClick={handleOpenModal} style={{ padding: '10px 20px' }}>
            + Nuevo Objetivo
          </button>
        </div>

        <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          
          {/* Panel Objetivos */}
          <div className="card" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 style={{ color: '#00e5ff', marginBottom: '15px' }}>Objetivos Activos</h3>
            {loading ? <p style={{ color: '#aaa' }}>Cargando...</p> : objetivos.length === 0 ? (
              <p style={{ color: '#aaa' }}>No hay objetivos configurados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {objetivos.map(obj => (
                  <div key={obj.id} style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>Meta: {obj.meta_registros_activos} Referidos</div>
                      <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Mínimo de compras: {obj.compras_minimas_usuario}</div>
                      <div style={{ color: '#00e5ff', fontSize: '0.9rem', marginTop: '5px' }}>Premio: {renderPremioName(obj.recompensa_tipo, obj.recompensa_valor)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                      <button 
                        onClick={() => toggleEstadoObjetivo(obj.id, obj.estado)}
                        style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: obj.estado ? 'rgba(0, 200, 83, 0.2)' : 'rgba(255, 255, 255, 0.1)', color: obj.estado ? '#00c853' : '#aaa', cursor: 'pointer' }}
                      >
                        {obj.estado ? 'Activo' : 'Inactivo'}
                      </button>
                      <button 
                        onClick={() => deleteObjetivo(obj.id)}
                        style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: 'rgba(255, 0, 0, 0.1)', color: '#ff4444', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel Top Referidores */}
          <div className="card" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 style={{ color: '#ffb300', marginBottom: '15px' }}>Top Referidores</h3>
            {loading ? <p style={{ color: '#aaa' }}>Cargando...</p> : topReferidores.length === 0 ? (
              <p style={{ color: '#aaa' }}>Aún no hay referidores registrados.</p>
            ) : (
              <table className="hulk-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th style={{ textAlign: 'center' }}>Invitados</th>
                  </tr>
                </thead>
                <tbody>
                  {topReferidores.map((t, idx) => (
                    <tr key={t.id}>
                      <td>
                        {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : ''}
                        {t.nombres} {t.apellidos} {t.nickname ? `(${t.nickname})` : ''}
                        <br/>
                        <small style={{ color: '#aaa' }}>{t.usuario}</small>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ffb300' }}>
                        {t.totalReferidos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>Nuevo Objetivo de Referidos</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group mb-16">
                <label className="form-label">Meta de Referidos (Cantidad)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="1"
                  required
                  value={formData.meta_registros_activos}
                  onChange={e => setFormData({...formData, meta_registros_activos: e.target.value})}
                />
              </div>

              <div className="form-group mb-16">
                <label className="form-label">Mínimo de compras requeridas por referido</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="1"
                  required
                  value={formData.compras_minimas_usuario}
                  onChange={e => setFormData({...formData, compras_minimas_usuario: e.target.value})}
                />
                <small style={{ color: '#aaa' }}>El referido debe completar esta cantidad de recargas para contar en la meta.</small>
              </div>

              <div className="form-group mb-16">
                <label className="form-label">Tipo de Recompensa</label>
                <select 
                  className="form-input"
                  value={formData.recompensa_tipo}
                  onChange={e => {
                    setFormData({...formData, recompensa_tipo: e.target.value, recompensa_valor: ''})
                    setSelectedJuego('')
                  }}
                >
                  <option value="saldo_usd">Saldo en Billetera (USD)</option>
                  <option value="saldo_bs">Saldo en Billetera (Bs)</option>
                  <option value="producto">Producto Específico</option>
                </select>
              </div>

              {formData.recompensa_tipo === 'producto' ? (
                <>
                  <div className="form-group mb-16">
                    <label className="form-label">Filtrar por Juego (Opcional)</label>
                    <select className="form-input" value={selectedJuego} onChange={e => setSelectedJuego(e.target.value)}>
                      <option value="">-- Seleccionar Juego --</option>
                      {juegos.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group mb-24">
                    <label className="form-label">Seleccionar Producto</label>
                    <select 
                      className="form-input" 
                      required
                      value={formData.recompensa_valor}
                      onChange={e => setFormData({...formData, recompensa_valor: e.target.value})}
                    >
                      <option value="">-- Elige un Producto --</option>
                      {productos
                        .filter(p => !selectedJuego || p.juego_id === parseInt(selectedJuego))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))
                      }
                    </select>
                  </div>
                </>
              ) : (
                <div className="form-group mb-24">
                  <label className="form-label">Monto ({formData.recompensa_tipo === 'saldo_usd' ? '$' : 'Bs'})</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    step="0.01"
                    min="0"
                    required
                    value={formData.recompensa_valor}
                    onChange={e => setFormData({...formData, recompensa_valor: e.target.value})}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#333' }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar Objetivo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alertModal && (
        <AlertModal 
          type={alertModal.type} 
          title={alertModal.title} 
          message={alertModal.message} 
          onClose={() => setAlertModal(null)} 
        />
      )}
    </div>
  )
}
