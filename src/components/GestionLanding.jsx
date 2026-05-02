import React, { useState, useEffect } from 'react'
import { useConfiguracion } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'
import { ToastContainer, toast } from 'react-toastify'

export default function GestionLanding() {
  const { config, updateConfig, loading } = useConfiguracion()
  const [juegos, setJuegos] = useState([])
  const [loadingJuegos, setLoadingJuegos] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  // Local state for form fields to avoid constant context updates during typing
  const [form, setForm] = useState({
    landing_titulo: config?.landing_titulo || '',
    landing_subtitulo: config?.landing_subtitulo || '',
    landing_logo: config?.landing_logo || '',
    landing_banner_1: config?.landing_banner_1 || '',
    landing_banner_1_title: config?.landing_banner_1_title || '',
    landing_banner_1_text: config?.landing_banner_1_text || '',
    landing_banner_1_btn_text: config?.landing_banner_1_btn_text || '',
    landing_banner_1_url: config?.landing_banner_1_url || '',
    landing_banner_2: config?.landing_banner_2 || '',
    landing_banner_2_title: config?.landing_banner_2_title || '',
    landing_banner_2_text: config?.landing_banner_2_text || '',
    landing_banner_2_btn_text: config?.landing_banner_2_btn_text || '',
    landing_banner_2_url: config?.landing_banner_2_url || '',
    landing_banner_3: config?.landing_banner_3 || '',
    landing_banner_3_title: config?.landing_banner_3_title || '',
    landing_banner_3_text: config?.landing_banner_3_text || '',
    landing_banner_3_btn_text: config?.landing_banner_3_btn_text || '',
    landing_banner_3_url: config?.landing_banner_3_url || '',
    landing_featured_games: config?.landing_featured_games || '',
    landing_enabled: config?.landing_enabled === '1'
  })

  // Sincronizar cuando cargue la config real
  React.useEffect(() => {
    fetchJuegos()
    if (config) {
      setForm({
        landing_titulo: config.landing_titulo || '',
        landing_subtitulo: config.landing_subtitulo || '',
        landing_logo: config.landing_logo || '',
        landing_banner_1: config.landing_banner_1 || '',
        landing_banner_1_title: config.landing_banner_1_title || '',
        landing_banner_1_text: config.landing_banner_1_text || '',
        landing_banner_1_btn_text: config.landing_banner_1_btn_text || '',
        landing_banner_1_url: config.landing_banner_1_url || '',
        landing_banner_2: config.landing_banner_2 || '',
        landing_banner_2_title: config.landing_banner_2_title || '',
        landing_banner_2_text: config.landing_banner_2_text || '',
        landing_banner_2_btn_text: config.landing_banner_2_btn_text || '',
        landing_banner_2_url: config.landing_banner_2_url || '',
        landing_banner_3: config.landing_banner_3 || '',
        landing_banner_3_title: config.landing_banner_3_title || '',
        landing_banner_3_text: config.landing_banner_3_text || '',
        landing_banner_3_btn_text: config.landing_banner_3_btn_text || '',
        landing_banner_3_url: config.landing_banner_3_url || '',
        landing_featured_games: config.landing_featured_games || '',
        landing_enabled: config.landing_enabled === '1'
      })
    }
  }, [config])

  const fetchJuegos = async () => {
    const { data } = await supabase
      .from('juegos')
      .select('*')
      .is('owner_id', null)
      .order('orden_landing', { ascending: true })
      .order('nombre')
    if (data) setJuegos(data)
    setLoadingJuegos(false)
  }

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('juegoIndex', index)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()
    const sourceIndex = parseInt(e.dataTransfer.getData('juegoIndex'), 10)
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return

    const newJuegos = [...juegos]
    const [movedItem] = newJuegos.splice(sourceIndex, 1)
    newJuegos.splice(targetIndex, 0, movedItem)
    setJuegos(newJuegos)
  }

  const toggleVisibility = (juegoId, currentState) => {
    // Si mostrar_en_landing no está definido, asumimos que es true
    const isVisible = currentState !== false
    setJuegos(juegos.map(j => j.id === juegoId ? { ...j, mostrar_en_landing: !isVisible } : j))
  }

  const handleDeleteGame = async (juegoId, nombre) => {
    if (!window.confirm(`¿Estás SEGURO de eliminar definitivamente "${nombre}"?\nEsta acción borrará el servicio del sistema por completo y no se puede deshacer.`)) {
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('juegos').delete().eq('id', juegoId)
      if (error) throw error
      
      setJuegos(juegos.filter(j => j.id !== juegoId))
      toast.success(`"${nombre}" eliminado definitivamente.`)
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveCatalogOrder = async () => {
    setSaving(true)
    try {
      const updates = juegos.map((j, idx) => ({
        id: j.id,
        nombre: j.nombre, // Necesario en upsert si hay campos NOT NULL, depende del esquema.
        activo: j.activo,
        mostrar_en_landing: j.mostrar_en_landing !== false,
        orden_landing: idx
      }))

      // Usamos update en un bucle si upsert requiere columnas que no tenemos. Para asegurar, iteramos.
      // Ya que no queremos sobreescribir otros datos, Promise.all es mejor.
      const promises = juegos.map((j, idx) => 
        supabase.from('juegos').update({
          mostrar_en_landing: j.mostrar_en_landing !== false,
          orden_landing: idx
        }).eq('id', j.id)
      )
      
      await Promise.all(promises)
      toast.success('Orden y visibilidad del catálogo guardados correctamente')
    } catch (err) {
      toast.error('Error al guardar organización: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateDiscount = async (juegoId) => {
    // Buscar el input por ID para obtener su valor actual de forma segura
    const input = document.getElementById(`discount-input-${juegoId}`)
    const label = input ? input.value : ''

    setSaving(true)
    const { error } = await supabase.from('juegos').update({ etiqueta_descuento: label }).eq('id', juegoId)
    setSaving(false)

    if (!error) {
      setJuegos(juegos.map(j => j.id === juegoId ? { ...j, etiqueta_descuento: label } : j))
      toast.success('Etiqueta actualizada correctamente')
    } else {
      toast.error('Error al actualizar: ' + error.message)
    }
  }

  const handleUploadBanner = async (e, bannerNumber) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La imagen no debe superar los 5MB")
        return
      }

      setSaving(true)
      
      const fileName = `banner-${bannerNumber}-${Date.now()}.${file.name.split('.').pop()}`
      
      const { error: uploadError } = await supabase.storage
        .from('logos') // Usamos el bucket público existente
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
      
      if (data?.publicUrl) {
        if (bannerNumber === 'logo') {
          setForm(prev => ({ ...prev, landing_logo: data.publicUrl }))
          toast.success(`Logo subido correctamente`)
        } else {
          setForm(prev => ({ ...prev, [`landing_banner_${bannerNumber}`]: data.publicUrl }))
          toast.success(`Banner ${bannerNumber} subido correctamente`)
        }
      }
    } catch (err) {
      toast.error('Error al subir imagen: ' + err.message)
    } finally {
      setSaving(false)
      e.target.value = null
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const results = await Promise.all([
        updateConfig('landing_titulo', form.landing_titulo, true),
        updateConfig('landing_subtitulo', form.landing_subtitulo, true), // Legacy fallback
        updateConfig('landing_logo', form.landing_logo, true),
        updateConfig('landing_banner_1', form.landing_banner_1, true),
        updateConfig('landing_banner_1_title', form.landing_banner_1_title, true),
        updateConfig('landing_banner_1_text', form.landing_banner_1_text, true),
        updateConfig('landing_banner_1_btn_text', form.landing_banner_1_btn_text, true),
        updateConfig('landing_banner_1_url', form.landing_banner_1_url, true),
        updateConfig('landing_banner_2', form.landing_banner_2, true),
        updateConfig('landing_banner_2_title', form.landing_banner_2_title, true),
        updateConfig('landing_banner_2_text', form.landing_banner_2_text, true),
        updateConfig('landing_banner_2_btn_text', form.landing_banner_2_btn_text, true),
        updateConfig('landing_banner_2_url', form.landing_banner_2_url, true),
        updateConfig('landing_banner_3', form.landing_banner_3, true),
        updateConfig('landing_banner_3_title', form.landing_banner_3_title, true),
        updateConfig('landing_banner_3_text', form.landing_banner_3_text, true),
        updateConfig('landing_banner_3_btn_text', form.landing_banner_3_btn_text, true),
        updateConfig('landing_banner_3_url', form.landing_banner_3_url, true),
        updateConfig('landing_featured_games', form.landing_featured_games, true),
        updateConfig('landing_enabled', form.landing_enabled ? '1' : '0', false)
      ])

      const errorResult = results.find(r => r && r.error)
      if (errorResult) {
        throw new Error(errorResult.error.message || 'Error guardando en la base de datos')
      }

      setAlert({ type: 'success', title: '¡Éxito!', message: 'Configuración de la Landing Page actualizada correctamente.' })
    } catch (err) {
      console.error(err)
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar la configuración: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-content">Cargando...</div>

  return (
    <div className="page-content">
      <div className="section-header-modern">
        <div className="section-title-group">
          <h2 className="section-title">Gestión de Landing Page</h2>
          <p className="section-subtitle">Personaliza la cara pública de tu plataforma</p>
        </div>
      </div>

      <div className="card-modern shadow-md" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSave} className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Estado de la Landing Page</label>
            <div className="flex items-center gap-12" style={{ marginTop: '8px' }}>
              <input 
                type="checkbox" 
                checked={form.landing_enabled}
                onChange={(e) => setForm({...form, landing_enabled: e.target.checked})}
                id="landing_enabled_check"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="landing_enabled_check" style={{ cursor: 'pointer' }}>
                Habilitar Landing Page (Si se desactiva, mostrará el Login directamente)
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Título Principal</label>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_titulo}
              onChange={(e) => setForm({...form, landing_titulo: e.target.value})}
              placeholder="Ej: Ceriraga Recargas"
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Logo de la Landing Page</label>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              {form.landing_logo && <img src={form.landing_logo} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', background: '#000' }} />}
              <input 
                type="text" 
                className="form-input"
                value={form.landing_logo}
                onChange={(e) => setForm({...form, landing_logo: e.target.value})}
                placeholder="URL de la imagen del logo..."
                style={{ flex: 1 }}
              />
              <input type="file" id="upload_logo" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUploadBanner(e, 'logo')} />
              <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('upload_logo').click()} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                📁 Subir Logo
              </button>
            </div>
          </div>

          <div className="form-group full-width" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Banner 1 (Principal)</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Imagen de fondo</label>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <input type="text" className="form-input" value={form.landing_banner_1} onChange={(e) => setForm({...form, landing_banner_1: e.target.value})} placeholder="URL de la imagen..." style={{ flex: 1 }} />
                  <input type="file" id="upload_banner_1" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUploadBanner(e, 1)} />
                  <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('upload_banner_1').click()} disabled={saving} style={{ whiteSpace: 'nowrap' }}>📁 Subir Imagen</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input type="text" className="form-input" value={form.landing_banner_1_title} onChange={(e) => setForm({...form, landing_banner_1_title: e.target.value})} placeholder="Ej: ¡Recargas al Instante!" />
              </div>
              <div className="form-group">
                <label className="form-label">Texto Descriptivo</label>
                <input type="text" className="form-input" value={form.landing_banner_1_text} onChange={(e) => setForm({...form, landing_banner_1_text: e.target.value})} placeholder="Seguridad y confianza en cada transacción" />
              </div>
              <div className="form-group">
                <label className="form-label">Texto del Botón</label>
                <input type="text" className="form-input" value={form.landing_banner_1_btn_text} onChange={(e) => setForm({...form, landing_banner_1_btn_text: e.target.value})} placeholder="Empieza ahora" />
              </div>
              <div className="form-group">
                <label className="form-label">URL de Redirección (Botón)</label>
                <input type="text" className="form-input" value={form.landing_banner_1_url} onChange={(e) => setForm({...form, landing_banner_1_url: e.target.value})} placeholder="Ej: /register o https://..." />
              </div>
            </div>
          </div>

          <div className="form-group full-width" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Banner 2</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Imagen de fondo</label>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <input type="text" className="form-input" value={form.landing_banner_2} onChange={(e) => setForm({...form, landing_banner_2: e.target.value})} placeholder="URL de la imagen..." style={{ flex: 1 }} />
                  <input type="file" id="upload_banner_2" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUploadBanner(e, 2)} />
                  <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('upload_banner_2').click()} disabled={saving} style={{ whiteSpace: 'nowrap' }}>📁 Subir Imagen</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input type="text" className="form-input" value={form.landing_banner_2_title} onChange={(e) => setForm({...form, landing_banner_2_title: e.target.value})} placeholder="Ej: Los mejores precios" />
              </div>
              <div className="form-group">
                <label className="form-label">Texto Descriptivo</label>
                <input type="text" className="form-input" value={form.landing_banner_2_text} onChange={(e) => setForm({...form, landing_banner_2_text: e.target.value})} placeholder="" />
              </div>
              <div className="form-group">
                <label className="form-label">Texto del Botón</label>
                <input type="text" className="form-input" value={form.landing_banner_2_btn_text} onChange={(e) => setForm({...form, landing_banner_2_btn_text: e.target.value})} placeholder="Empieza ahora" />
              </div>
              <div className="form-group">
                <label className="form-label">URL de Redirección (Botón)</label>
                <input type="text" className="form-input" value={form.landing_banner_2_url} onChange={(e) => setForm({...form, landing_banner_2_url: e.target.value})} placeholder="Ej: /register o https://..." />
              </div>
            </div>
          </div>

          <div className="form-group full-width" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px', paddingBottom: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Banner 3</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Imagen de fondo</label>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <input type="text" className="form-input" value={form.landing_banner_3} onChange={(e) => setForm({...form, landing_banner_3: e.target.value})} placeholder="URL de la imagen..." style={{ flex: 1 }} />
                  <input type="file" id="upload_banner_3" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUploadBanner(e, 3)} />
                  <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('upload_banner_3').click()} disabled={saving} style={{ whiteSpace: 'nowrap' }}>📁 Subir Imagen</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input type="text" className="form-input" value={form.landing_banner_3_title} onChange={(e) => setForm({...form, landing_banner_3_title: e.target.value})} placeholder="" />
              </div>
              <div className="form-group">
                <label className="form-label">Texto Descriptivo</label>
                <input type="text" className="form-input" value={form.landing_banner_3_text} onChange={(e) => setForm({...form, landing_banner_3_text: e.target.value})} placeholder="" />
              </div>
              <div className="form-group">
                <label className="form-label">Texto del Botón</label>
                <input type="text" className="form-input" value={form.landing_banner_3_btn_text} onChange={(e) => setForm({...form, landing_banner_3_btn_text: e.target.value})} placeholder="Empieza ahora" />
              </div>
              <div className="form-group">
                <label className="form-label">URL de Redirección (Botón)</label>
                <input type="text" className="form-input" value={form.landing_banner_3_url} onChange={(e) => setForm({...form, landing_banner_3_url: e.target.value})} placeholder="Ej: /register o https://..." />
              </div>
            </div>
          </div>

          <div className="form-group full-width">
            <label className="form-label">IDs de Juegos Destacados (Bestsellers)</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Ingresa los IDs de los juegos separados por comas (ej: 1, 15, 22). Si dejas vacío, se mostrarán los primeros 12.
            </p>
            <input 
              type="text" 
              className="form-input"
              value={form.landing_featured_games}
              onChange={(e) => setForm({...form, landing_featured_games: e.target.value})}
              placeholder="1, 2, 5, 8"
            />
          </div>

          <div className="flex justify-end full-width" style={{ marginTop: '20px' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ minWidth: '180px' }}
              disabled={saving}
            >
              {saving ? '⏳ Guardando...' : '💾 Guardar Cambios Generales'}
            </button>
          </div>
        </form>
      </div>

      <div className="section-header-modern" style={{ marginTop: '40px' }}>
        <div className="section-title-group">
          <h2 className="section-title">Organización del Catálogo</h2>
          <p className="section-subtitle">Oculta juegos de la Landing Page y arrástralos (☰) para cambiar el orden en que aparecen al público.</p>
        </div>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={saveCatalogOrder} disabled={saving}>
            {saving ? '⏳ Guardando...' : '💾 Guardar Orden y Visibilidad'}
          </button>
        </div>
      </div>

      <div className="card-modern shadow-md">
        {loadingJuegos ? <p>Cargando catálogo...</p> : (
          <div className="catalog-dnd-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {juegos.map((j, idx) => {
              const isVisible = j.mostrar_en_landing !== false
              return (
                <div 
                  key={j.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    background: isVisible ? 'var(--bg-card)' : 'var(--bg-page)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    opacity: isVisible ? 1 : 0.6,
                    transition: 'opacity 0.2s, background 0.2s'
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', cursor: 'grab', fontSize: '20px' }}>
                    ☰
                  </div>
                  <img src={j.icono_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{j.nombre}</h4>
                    {!isVisible && <span style={{ fontSize: '12px', color: '#ff4d4f' }}>Oculto en Landing</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button"
                      onClick={() => toggleVisibility(j.id, isVisible)}
                      style={{
                        background: isVisible ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)',
                        color: isVisible ? '#ff4d4f' : '#52c41a',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isVisible ? '✖ Ocultar' : '➕ Mostrar'}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => handleDeleteGame(j.id, j.nombre)}
                      style={{
                        background: 'rgba(255, 0, 0, 0.1)',
                        color: '#ff0000',
                        border: '1px solid #ff0000',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Eliminar juego definitivamente"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="section-header-modern" style={{ marginTop: '40px' }}>
        <div className="section-title-group">
          <h2 className="section-title">Etiquetas de Descuento (Ganchos Visuales)</h2>
          <p className="section-subtitle">Configura los descuentos que se verán en la landing page para cada juego.</p>
        </div>
      </div>

      <div className="card-modern shadow-md">
        {loadingJuegos ? <p>Cargando juegos...</p> : (
          <div className="table-responsive">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Juego</th>
                  <th>Etiqueta Actual</th>
                  <th>Nueva Etiqueta (Ej: -25%)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {juegos.map(j => (
                  <tr key={j.id}>
                    <td>
                      <div className="flex items-center gap-8">
                        <img src={j.icono_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                        {j.nombre}
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: j.etiqueta_descuento ? '#ff6b6b' : '#666', color: 'white' }}>
                        {j.etiqueta_descuento || 'Sin descuento'}
                      </span>
                    </td>
                    <td>
                      <input 
                        id={`discount-input-${j.id}`}
                        type="text" 
                        className="form-input" 
                        style={{ padding: '4px 8px', width: '100px' }}
                        defaultValue={j.etiqueta_descuento}
                        placeholder="-20%"
                      />
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleUpdateDiscount(j.id)}
                        disabled={saving}
                      >
                        Actualizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {alert && (
        <AlertModal 
          type={alert.type} 
          title={alert.title} 
          message={alert.message} 
          onClose={() => setAlert(null)} 
        />
      )}
      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  )
}
