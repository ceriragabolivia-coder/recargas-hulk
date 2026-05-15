import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, ToastContainer } from 'react-toastify'
import AlertModal from './AlertModal'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

export default function GestionPaginas() {
  const [paginas, setPaginas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingPage, setEditingPage] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  }

  useEffect(() => {
    fetchPaginas()
  }, [])

  const fetchPaginas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('paginas_estaticas')
      .select('*')
      .order('categoria', { ascending: true })
      .order('orden', { ascending: true })
    
    if (error) {
      toast.error('Error al cargar páginas: ' + error.message)
    } else {
      setPaginas(data || [])
    }
    setLoading(false)
  }

  const handleEdit = (pagina) => {
    setEditingPage({ ...pagina })
    setShowModal(true)
  }

  const handleCreate = () => {
    setEditingPage({
      slug: '',
      titulo: '',
      contenido: '',
      categoria: 'Empresa',
      visible: true,
      orden: 0
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const { id, ...dataToSave } = editingPage
      let error
      
      if (id) {
        // Update
        const { error: err } = await supabase
          .from('paginas_estaticas')
          .update({ ...dataToSave, updated_at: new Date() })
          .eq('id', id)
        error = err
      } else {
        // Create
        const { error: err } = await supabase
          .from('paginas_estaticas')
          .insert([dataToSave])
        error = err
      }

      if (error) throw error
      
      toast.success(id ? 'Página actualizada' : 'Página creada')
      setShowModal(false)
      fetchPaginas()
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, titulo) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la página "${titulo}"?`)) return
    
    try {
      const { error } = await supabase
        .from('paginas_estaticas')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Página eliminada')
      fetchPaginas()
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  const toggleVisibility = async (id, currentVisible) => {
    try {
      const { error } = await supabase
        .from('paginas_estaticas')
        .update({ visible: !currentVisible })
        .eq('id', id)
      
      if (error) throw error
      fetchPaginas()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  if (loading) return <div className="page-content">Cargando páginas...</div>

  return (
    <div className="page-content">
      <div className="section-header-modern">
        <div className="section-title-group">
          <h2 className="section-title">Gestión de Páginas del Footer</h2>
          <p className="section-subtitle">Crea y edita los artículos que aparecen en el pie de página de la Landing</p>
        </div>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={handleCreate}>
            ➕ Nueva Página
          </button>
        </div>
      </div>

      <div className="card-modern shadow-md">
        <div className="table-responsive">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Título</th>
                <th>Slug (URL)</th>
                <th>Categoría</th>
                <th>Visibilidad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginas.map((p) => (
                <tr key={p.id}>
                  <td style={{ width: '80px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>#{p.orden}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.titulo}</div>
                  </td>
                  <td>
                    <code style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      /{p.slug}
                    </code>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: p.categoria === 'Empresa' ? 'var(--accent-primary)' : '#00d2ff', color: 'black' }}>
                      {p.categoria}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => toggleVisibility(p.id, p.visible)}
                      style={{ 
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontSize: '20px', filter: p.visible ? 'none' : 'grayscale(1) opacity(0.3)'
                      }}
                      title={p.visible ? 'Visible' : 'Oculto'}
                    >
                      {p.visible ? '👁️' : '🚫'}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(p)}>
                        📝 Editar
                      </button>
                      <button className="btn btn-sm" style={{ background: 'rgba(255,0,0,0.1)', color: '#ff4d4f' }} onClick={() => handleDelete(p.id, p.titulo)}>
                        🗑️ Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginas.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay páginas creadas. Haz clic en "Nueva Página" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card-modern" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPage.id ? 'Editar Página' : 'Crear Nueva Página'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="form-grid" style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Título de la Página</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editingPage.titulo} 
                  onChange={e => setEditingPage({...editingPage, titulo: e.target.value})}
                  required
                  placeholder="Ej: Términos y Condiciones"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug (Identificador en URL)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editingPage.slug} 
                  onChange={e => setEditingPage({...editingPage, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})}
                  required
                  placeholder="ej-terminos-condiciones"
                  disabled={editingPage.id} // Evitar romper enlaces existentes
                />
              </div>
              <div className="form-group">
                <label className="form-label">Categoría en Footer</label>
                <select 
                  className="form-input" 
                  value={editingPage.categoria}
                  onChange={e => setEditingPage({...editingPage, categoria: e.target.value})}
                >
                  <option value="Empresa">Empresa</option>
                  <option value="Soporte">Soporte</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Orden de Aparición</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={editingPage.orden} 
                  onChange={e => setEditingPage({...editingPage, orden: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Contenido del Artículo</label>
                <div style={{ background: 'white', color: 'black', borderRadius: '8px', overflow: 'hidden' }}>
                  <ReactQuill 
                    theme="snow"
                    value={editingPage.contenido}
                    onChange={content => setEditingPage({...editingPage, contenido: content})}
                    modules={modules}
                    style={{ height: '400px', marginBottom: '50px' }}
                  />
                </div>
              </div>
              
              <div className="flex justify-end full-width gap-12" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳ Guardando...' : '💾 Guardar Página'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alert && (
        <AlertModal 
          type={alert.type} 
          title={alert.title} 
          message={alert.message} 
          onClose={() => setAlert(null)} 
        />
      )}
      <ToastContainer position="bottom-right" theme="dark" />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .close-btn {
          background: none;
          border: none;
          color: var(--text-main);
          font-size: 20px;
          cursor: pointer;
        }
      `}} />
    </div>
  )
}
