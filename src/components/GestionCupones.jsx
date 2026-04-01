import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'

export default function GestionCupones() {
  const [cupones, setCupones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCupon, setEditingCupon] = useState(null)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  const [formData, setFormData] = useState({
    codigo: '',
    porcentaje: 0,
    fecha_expiracion: '',
    limite_usos: 0,
    activo: true
  })

  const fetchCupones = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cupones')
      .select(`
        *,
        cupones_usados(count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code !== '42P01') { // Ignore if table doesn't exist yet
        setAlert({ type: 'error', message: "Error al cargar cupones: " + error.message })
      }
    } else {
      setCupones(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCupones()
  }, [])

  const handleOpenModal = (cupon = null) => {
    if (cupon) {
      setEditingCupon(cupon)
      setFormData({
        codigo: cupon.codigo,
        porcentaje: cupon.porcentaje,
        fecha_expiracion: cupon.fecha_expiracion ? new Date(cupon.fecha_expiracion).toISOString().split('T')[0] : '',
        limite_usos: cupon.limite_usos || 0,
        activo: cupon.activo
      })
    } else {
      setEditingCupon(null)
      setFormData({
        codigo: '',
        porcentaje: 10,
        fecha_expiracion: '',
        limite_usos: 100,
        activo: true
      })
    }
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)

    // Formatear fecha para tener fin del día y evitar problemas gmt
    let expireDate = null;
    if (formData.fecha_expiracion) {
      expireDate = new Date(`${formData.fecha_expiracion}T23:59:59-04:00`).toISOString()
    }

    const payload = {
      codigo: formData.codigo.toUpperCase().replace(/\s/g, ''),
      porcentaje: parseInt(formData.porcentaje),
      fecha_expiracion: expireDate,
      limite_usos: parseInt(formData.limite_usos) || null,
      activo: formData.activo
    }

    try {
      if (editingCupon) {
        const { error } = await supabase.from('cupones').update(payload).eq('id', editingCupon.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cupones').insert([payload])
        if (error) throw error
      }
      setShowModal(false)
      fetchCupones()
    } catch (err) {
      // 23505 = Codigo unico violado en Postgres
      if (err.code === '23505') {
        setAlert({ type: 'error', message: 'Ya existe un cupón con ese mismo código exacto.' })
      } else {
        setAlert({ type: 'error', message: err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleEstado = async (cupon) => {
    try {
      const { error } = await supabase.from('cupones').update({ activo: !cupon.activo }).eq('id', cupon.id)
      if (error) throw error
      setCupones(cupones.map(c => c.id === cupon.id ? { ...c, activo: !cupon.activo } : c))
    } catch (err) {
      setAlert({ type: 'error', message: 'Error al cambiar el estado: ' + err.message })
    }
  }

  const isExpired = (expiresAt) => {
    return expiresAt && new Date(expiresAt) < new Date()
  }

  return (
    <div className="page-content" style={{ maxWidth: '100%', padding: '0 24px', margin: '0 auto' }}>
      <div className="page-header mb-24" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Gestión de Cupones</h1>
          <p className="page-subtitle">Crea descuentos y promociones especiales para tus clientes</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Crear Nuevo Cupón
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cupones...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descuento</th>
                  <th>Validez / Expiración</th>
                  <th>Stock / Usos</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cupones.map(cupon => {
                  const expirado = isExpired(cupon.fecha_expiracion)
                  const agotado = cupon.limite_usos && cupon.cupones_usados?.[0]?.count >= cupon.limite_usos

                  return (
                    <tr key={cupon.id} style={{ opacity: (!cupon.activo || expirado || agotado) ? 0.6 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--accent-primary)', letterSpacing: '1px' }}>
                          {cupon.codigo}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent-success)' }}>
                          -{cupon.porcentaje}% OFF
                        </span>
                      </td>
                      <td>
                        {cupon.fecha_expiracion ? (
                          <div style={{ color: expirado ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                            {expirado ? 'Expiró el ' : 'Hasta el '} 
                            {new Date(cupon.fecha_expiracion).toLocaleDateString('es-VE')}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Ilimitado en Tiempo</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          Usado: {cupon.cupones_usados?.[0]?.count || 0}
                          {cupon.limite_usos ? ` / ${cupon.limite_usos}` : ' (Ilimitado)'}
                        </div>
                        {agotado && (
                          <div style={{ fontSize: '11px', color: 'var(--accent-danger)', fontWeight: 'bold' }}>AGOTADO</div>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${cupon.activo ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '12px' }}
                          onClick={() => toggleEstado(cupon)}
                        >
                          {cupon.activo ? 'ACTIVO' : 'PAUSADO'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-ghost"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                          onClick={() => handleOpenModal(cupon)}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {cupones.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No tienes cupones creados aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Crear/Editar Cupón */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCupon ? (editingCupon.codigo) : 'Crear Cupón'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Código del Cupón (Sin espacios)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  placeholder="Ej: REGALOS2026"
                  value={formData.codigo}
                  onChange={(e) => setFormData({...formData, codigo: e.target.value.toUpperCase().replace(/\s/g, '')})}
                  style={{ textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Porcentaje de Descuento (%)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    required min="1" max="100"
                    value={formData.porcentaje}
                    onChange={(e) => setFormData({...formData, porcentaje: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Stock / Límite de Usos Global</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="1" placeholder="Ej: 100"
                    value={formData.limite_usos}
                    onChange={(e) => setFormData({...formData, limite_usos: e.target.value})}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Dejar vacío para límite infinito</div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Fecha de Expiración (Opcional)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.fecha_expiracion}
                  onChange={(e) => setFormData({...formData, fecha_expiracion: e.target.value})}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Dejar vacío para que no expensa por tiempo.</div>
              </div>

              <div className="form-group" style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="cupon-activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="cupon-activo" style={{ cursor: 'pointer', fontWeight: 'bold' }}>Cupón Encendido (Activo)</label>
              </div>

              <div className="modal-actions mt-24">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cupón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alert && (
        <AlertModal 
          type={alert.type} 
          message={alert.message} 
          onClose={() => setAlert(null)} 
        />
      )}
    </div>
  )
}
