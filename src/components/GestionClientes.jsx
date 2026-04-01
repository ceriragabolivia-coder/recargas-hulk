import React, { useState, useMemo } from 'react'
import { useClientes } from '../hooks/useData'
import { formatDate } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function GestionClientes() {
  const { clientes, loading, createCliente, updateCliente, deleteCliente, updateProfileStatus } = useClientes()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [alertModal, setAlertModal] = useState(null) // { type, title, message, onConfirm }
// ... (rest of the component state/logic stays same until table)
// ... skipping to table part for targetContent accuracy
// ... Actually I will use a larger chunk to be safe.

  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    usuario: '',
    password_correo: '',
    whatsapp: '',
    nickname: '',
    pais: 'Venezuela',
    estado: '',
    ip_registro: ''
  })

  const filteredClientes = useMemo(() => {
    if (!search) return clientes
    const s = search.toLowerCase()
    return clientes.filter(c => 
      c.nombres?.toLowerCase()?.includes(s) || 
      c.apellidos?.toLowerCase()?.includes(s) || 
      c.nickname?.toLowerCase()?.includes(s) ||
      c.usuario?.toLowerCase()?.includes(s) ||
      c.whatsapp?.toLowerCase()?.includes(s)
    )
  }, [clientes, search])

  const handleOpenModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente)
      setFormData({
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        usuario: cliente.usuario,
        password_correo: cliente.password_correo || '',
        whatsapp: cliente.whatsapp || '',
        nickname: cliente.nickname || '',
        pais: cliente.pais || 'Venezuela',
        estado: cliente.estado || '',
        ip_registro: cliente.ip_registro || ''
      })
    } else {
      setEditingCliente(null)
      setFormData({
        nombres: '',
        apellidos: '',
        usuario: '',
        password_correo: '',
        whatsapp: '',
        nickname: '',
        pais: 'Venezuela',
        estado: '',
        ip_registro: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (editingCliente) {
      const { error } = await updateCliente(editingCliente.id, formData)
      if (error) setAlertModal({ type: 'error', message: 'Error al actualizar: ' + error.message })
      else setShowModal(false)
    } else {
      const { error } = await createCliente(formData)
      if (error) setAlertModal({ type: 'error', message: 'Error al crear: ' + error.message })
      else setShowModal(false)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id, nombre) => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Usuario',
      message: `¿Seguro que quieres eliminar a ${nombre}?`,
      onConfirm: async () => {
        const { error } = await deleteCliente(id)
        if (error) setAlertModal({ type: 'error', message: 'Error al eliminar: ' + error.message })
        else setAlertModal(null)
      }
    })
  }

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <div>
          <h1 className="page-title">Gestión de Usuarios (Clientes)</h1>
          <p className="page-subtitle">Base de datos centralizada de tus clientes</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Añadir Usuario
        </button>
      </div>

      <div className="card mb-24" style={{ padding: '16px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por nombre, nickname, usuario o WhatsApp..." 
            style={{ width: '100%', paddingLeft: '40px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario / Nickname</th>
                <th>Nombre Completo</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Actividad</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></td></tr>
              ) : filteredClientes.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No se encontraron usuarios</td></tr>
              ) : (
                filteredClientes.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{c.usuario}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.nickname || 'Sin nickname'}</div>
                    </td>
                    <td>{c.nombres} {c.apellidos}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.whatsapp || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.password_correo ? '🔐 Pass Guardada' : 'No pass'}</div>
                    </td>
                    <td>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '10px', 
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: c.estado === 'aprobado' ? 'rgba(46, 204, 113, 0.1)' : c.estado === 'pendiente' ? 'rgba(241, 196, 15, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                        color: c.estado === 'aprobado' ? '#2ecc71' : c.estado === 'pendiente' ? '#f1c40f' : '#e74c3c',
                        border: `1px solid ${c.estado === 'aprobado' ? 'rgba(46, 204, 113, 0.2)' : c.estado === 'pendiente' ? 'rgba(241, 196, 15, 0.2)' : 'rgba(231, 76, 60, 0.2)'}`
                      }}>
                        {c.estado}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 11 }}>Reg: {formatDate(c.fecha_registro)}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent-success)' }}>Login: {c.ultimo_login ? formatDate(c.ultimo_login) : 'Nunca'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {c.estado === 'pendiente' && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => updateProfileStatus(c, 'aprobado')} title="Aprobar" style={{ color: '#2ecc71' }}>✓</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => updateProfileStatus(c, 'rechazado')} title="Rechazar" style={{ color: '#e74c3c' }}>✕</button>
                          </>
                        )}
                        {c.estado === 'rechazado' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => updateProfileStatus(c, 'aprobado')} title="Re-Aprobar" style={{ color: '#2ecc71' }}>↺</button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => handleOpenModal(c)}>✎</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id, c.nombres)} style={{ color: 'var(--error)' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCliente ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Nombres</label>
                  <input 
                    type="text" className="form-input" required 
                    value={formData.nombres} onChange={e => setFormData({...formData, nombres: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellidos</label>
                  <input 
                    type="text" className="form-input" required 
                    value={formData.apellidos} onChange={e => setFormData({...formData, apellidos: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Usuario</label>
                  <input 
                    type="text" className="form-input" required 
                    value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nickname</label>
                  <input 
                    type="text" className="form-input" 
                    value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Contraseña de Correo</label>
                <input 
                  type="text" className="form-input" 
                  value={formData.password_correo} onChange={e => setFormData({...formData, password_correo: e.target.value})}
                  placeholder="Secreto de acceso al correo del cliente"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Número de WhatsApp</label>
                <input 
                  type="text" className="form-input" 
                  value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">País</label>
                  <input 
                    type="text" className="form-input" 
                    value={formData.pais} onChange={e => setFormData({...formData, pais: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <input 
                    type="text" className="form-input" 
                    value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">IP de Registro (Manual/Ref)</label>
                <input 
                  type="text" className="form-input" 
                  value={formData.ip_registro} onChange={e => setFormData({...formData, ip_registro: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-12">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : editingCliente ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background-color: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
          animation: modalSlide 0.3s ease-out;
        }
        @keyframes modalSlide {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }
        .btn-close {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 24px;
          cursor: pointer;
        }
      `}} />

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={alertModal.onConfirm}
          onCancel={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
