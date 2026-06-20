import React, { useState, useEffect } from 'react'
import { useConfiguracion } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'
import { ToastContainer, toast } from 'react-toastify'
import { compressImage } from '../utils/imageCompression'

export default function GestionLanding() {
  const { config, updateConfig, loading } = useConfiguracion()
  const [juegos, setJuegos] = useState([])
  const [loadingJuegos, setLoadingJuegos] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [activeTab, setActiveTab] = useState('general')

  const [bannersList, setBannersList] = useState([])

  const [form, setForm] = useState({
    landing_titulo: config?.landing_titulo || '',
    landing_subtitulo: config?.landing_subtitulo || '',
    landing_logo: config?.landing_logo || '',
    landing_featured_games: config?.landing_featured_games || '',
    landing_seo_texto: config?.landing_seo_texto || '',
    landing_enabled: config?.landing_enabled === '1',
    landing_auth_icon: config?.landing_auth_icon || '⚡',
    landing_auth_logo_size: config?.landing_auth_logo_size || '100px',
    landing_auth_title_size: config?.landing_auth_title_size || '24px',
    landing_auth_text_size: config?.landing_auth_text_size || '14px'
  })

  // Sincronizar cuando cargue la config real
  React.useEffect(() => {
    fetchJuegos()
    if (config) {
      setForm({
        landing_titulo: config.landing_titulo || '',
        landing_subtitulo: config.landing_subtitulo || '',
        landing_logo: config.landing_logo || '',
        landing_featured_games: config.landing_featured_games || '',
        landing_seo_texto: config.landing_seo_texto || '',
        landing_enabled: config.landing_enabled === '1',
        landing_auth_icon: config.landing_auth_icon || '⚡',
        landing_auth_logo_size: config.landing_auth_logo_size || '100px',
        landing_auth_title_size: config.landing_auth_title_size || '24px',
        landing_auth_text_size: config.landing_auth_text_size || '14px'
      })
      if (config.landing_banners_json) {
        try {
          setBannersList(JSON.parse(config.landing_banners_json));
        } catch (e) {
          console.error("Error parsing landing_banners_json", e);
        }
      } else {
        // Fallback from legacy
        setBannersList([
          {
            id: 1, image: config.landing_banner_1 || '', title: config.landing_banner_1_title || '', text: config.landing_banner_1_text || '', btnText: config.landing_banner_1_btn_text || '', url: config.landing_banner_1_url || '', interval: config.landing_banner_1_interval || '5'
          },
          {
            id: 2, image: config.landing_banner_2 || '', title: config.landing_banner_2_title || '', text: config.landing_banner_2_text || '', btnText: config.landing_banner_2_btn_text || '', url: config.landing_banner_2_url || '', interval: config.landing_banner_2_interval || '5'
          },
          {
            id: 3, image: config.landing_banner_3 || '', title: config.landing_banner_3_title || '', text: config.landing_banner_3_text || '', btnText: config.landing_banner_3_btn_text || '', url: config.landing_banner_3_url || '', interval: config.landing_banner_3_interval || '5'
          }
        ].filter(b => b.image || b.title))
      }
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

  const handleUpdateGameBanner = async (juegoId, bannerUrl) => {
    setSaving(true)
    const { error } = await supabase.from('juegos').update({ banner_url: bannerUrl }).eq('id', juegoId)
    setSaving(false)

    if (!error) {
      setJuegos(juegos.map(j => j.id === juegoId ? { ...j, banner_url: bannerUrl } : j))
      toast.success('Banner de juego actualizado')
    } else {
      toast.error('Error al actualizar banner: ' + error.message)
    }
  }

  const handleUploadBanner = async (e, bannerNumber) => {
    try {
      let file = e.target.files[0]
      if (!file) return
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La imagen no debe superar los 5MB")
        return
      }

      setSaving(true)
      
      file = await compressImage(file)
      const fileName = `banner-${bannerNumber}-${Date.now()}-${file.name}`
      
      const { error: uploadError } = await supabase.storage
        .from('logos') // Usamos el bucket público existente
        .upload(fileName, file, { cacheControl: '31536000', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
      
        if (bannerNumber === 'logo') {
          setForm(prev => ({ ...prev, landing_logo: data.publicUrl }))
          toast.success(`Logo subido correctamente`)
        } else if (bannerNumber === 'auth_logo') {
          setForm(prev => ({ ...prev, landing_auth_icon: data.publicUrl }))
          toast.success(`Icono de login subido correctamente`)
        } else if (String(bannerNumber).startsWith('game_banner_')) {
          const juegoId = bannerNumber.replace('game_banner_', '')
          handleUpdateGameBanner(juegoId, data.publicUrl)
        } else {
          setBannersList(prev => prev.map(b => b.id === bannerNumber ? { ...b, image: data.publicUrl } : b))
          toast.success(`Banner subido correctamente`)
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
        updateConfig('landing_banners_json', JSON.stringify(bannersList), true),
        updateConfig('landing_featured_games', form.landing_featured_games, true),
        updateConfig('landing_seo_texto', form.landing_seo_texto, true),
        updateConfig('landing_enabled', form.landing_enabled ? '1' : '0', false),
        updateConfig('landing_auth_icon', form.landing_auth_icon, true),
        updateConfig('landing_auth_logo_size', form.landing_auth_logo_size, true),
        updateConfig('landing_auth_title_size', form.landing_auth_title_size, true),
        updateConfig('landing_auth_text_size', form.landing_auth_text_size, true)
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

  const updateBannerProp = (id, prop, value) => {
    setBannersList(prev => prev.map(b => b.id === id ? { ...b, [prop]: value } : b))
  }

  const addBanner = () => {
    setBannersList(prev => [...prev, {
      id: Date.now(),
      image: '',
      title: '',
      text: '',
      btnText: '',
      url: '',
      interval: '5',
      active: true
    }])
  }

  const removeBanner = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este banner?")) {
      setBannersList(prev => prev.filter(b => b.id !== id))
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

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button type="button" className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('general')}>General</button>
        <button type="button" className={`btn ${activeTab === 'banners' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('banners')}>Banners Promocionales</button>
        <button type="button" className={`btn ${activeTab === 'auth' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('auth')}>Acceso y Login</button>
        <button type="button" className={`btn ${activeTab === 'catalogo' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('catalogo')}>Catálogo y Descuentos</button>
      </div>

      {activeTab !== 'catalogo' && (
      <div className="card-modern shadow-md" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSave} className="form-grid">
          {activeTab === 'general' && (
            <>
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
              placeholder="Ej: Recargas Hulk"
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

          <div className="form-group full-width" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <label className="form-label">Texto SEO Global (Para Buscadores)</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Este texto aparecerá al final de la página principal para mejorar el posicionamiento. Puedes incluir palabras clave sobre recargas de juegos (Soporta HTML básico).
            </p>
            <textarea 
              className="form-input"
              rows={5}
              value={form.landing_seo_texto}
              onChange={(e) => setForm({...form, landing_seo_texto: e.target.value})}
              placeholder="Ej: Somos la mejor plataforma para recargar diamantes en Free Fire, Netflix..."
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
          </div>
          </>
          )}

          {activeTab === 'banners' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {bannersList.map((banner, index) => (
                <div key={banner.id} className="form-group full-width" style={{ marginTop: index > 0 ? '20px' : '0px', borderTop: index > 0 ? '1px solid var(--border)' : 'none', paddingTop: index > 0 ? '20px' : '0px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0 }}>Banner {index + 1} {index === 0 ? '(Principal)' : ''}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                        <input 
                          type="checkbox" 
                          checked={banner.active !== false} 
                          onChange={(e) => updateBannerProp(banner.id, 'active', e.target.checked)} 
                        />
                        <span style={{ color: banner.active !== false ? '#10b981' : 'var(--text-secondary)' }}>Activo</span>
                      </label>
                      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }}></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Tiempo de visualización (s):</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={banner.interval || '5'} 
                          onChange={(e) => updateBannerProp(banner.id, 'interval', e.target.value)} 
                          min="1"
                          style={{ width: '80px', padding: '6px 12px' }}
                        />
                      </div>
                      {bannersList.length > 1 && (
                        <button type="button" className="btn" style={{ background: '#ff4d4f', color: 'white', padding: '6px 12px' }} onClick={() => removeBanner(banner.id)}>Eliminar</button>
                      )}
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label className="form-label">Imagen de fondo</label>
                      <div className="flex gap-8" style={{ alignItems: 'center' }}>
                        <input type="text" className="form-input" value={banner.image || ''} onChange={(e) => updateBannerProp(banner.id, 'image', e.target.value)} placeholder="URL de la imagen..." style={{ flex: 1 }} />
                        <input type="file" id={`upload_banner_${banner.id}`} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUploadBanner(e, banner.id)} />
                        <button type="button" className="btn btn-secondary" onClick={() => document.getElementById(`upload_banner_${banner.id}`).click()} disabled={saving} style={{ whiteSpace: 'nowrap' }}>📁 Subir Imagen</button>
                      </div>
                      {banner.image && (
                        <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', height: '140px', width: '100%', border: '1px solid var(--border)', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={banner.image} alt={`Vista previa banner ${index + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Título</label>
                      <input type="text" className="form-input" value={banner.title || ''} onChange={(e) => updateBannerProp(banner.id, 'title', e.target.value)} placeholder="Ej: ¡Recargas al Instante!" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Texto Descriptivo</label>
                      <input type="text" className="form-input" value={banner.text || ''} onChange={(e) => updateBannerProp(banner.id, 'text', e.target.value)} placeholder="Seguridad y confianza" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Texto del Botón</label>
                      <input type="text" className="form-input" value={banner.btnText || ''} onChange={(e) => updateBannerProp(banner.id, 'btnText', e.target.value)} placeholder="Empieza ahora" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">URL de Redirección (Botón)</label>
                      <input type="text" className="form-input" value={banner.url || ''} onChange={(e) => updateBannerProp(banner.id, 'url', e.target.value)} placeholder="Ej: /register" />
                    </div>
                  </div>
                </div>
              ))}
              
              <div style={{ marginTop: '20px', borderTop: '1px dashed var(--border)', paddingTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={addBanner} style={{ width: '100%', maxWidth: '300px' }}>
                  ➕ Añadir Nuevo Banner (Carrusel)
                </button>
              </div>

              <div style={{ marginTop: '40px', borderTop: '2px solid var(--border)', paddingTop: '30px' }}>
                <h3 style={{ marginBottom: '10px' }}>Banners de Juegos (Solo Móvil)</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Estos banners se mostrarán en la parte superior de cada juego únicamente en dispositivos móviles, reemplazando el icono cuadrado para ahorrar espacio.
                </p>
                
                <div className="table-responsive card-modern">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>Juego/Servicio</th>
                        <th>Banner Actual (Móvil)</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {juegos.map(j => (
                        <tr key={j.id}>
                          <td>
                            <div className="flex items-center gap-8">
                              <img src={j.icono_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
                              {j.nombre}
                            </div>
                          </td>
                          <td>
                            {j.banner_url ? (
                              <div style={{ width: '120px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: '#000' }}>
                                <img src={j.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sin banner asignado</span>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-8">
                              <input 
                                type="file" 
                                id={`upload_game_banner_${j.id}`} 
                                style={{ display: 'none' }} 
                                accept="image/*" 
                                onChange={(e) => handleUploadBanner(e, `game_banner_${j.id}`)} 
                              />
                              <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                onClick={() => document.getElementById(`upload_game_banner_${j.id}`).click()}
                                disabled={saving}
                              >
                                {j.banner_url ? 'Cambiar' : 'Subir Banner'}
                              </button>
                              {j.banner_url && (
                                <button 
                                  type="button" 
                                  className="btn btn-sm" 
                                  style={{ background: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f' }}
                                  onClick={() => handleUpdateGameBanner(j.id, null)}
                                  disabled={saving}
                                >
                                  Borrar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'auth' && (
            <>
          <div className="form-group full-width" style={{ marginTop: '0px' }}>
            <h3 style={{ marginBottom: '16px' }}>Modal de Acceso (Login / Registro)</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Ícono o Logo (Emoji o Imagen URL)</label>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  {form.landing_auth_icon && form.landing_auth_icon.startsWith('http') ? (
                    <img src={form.landing_auth_icon} alt="Auth Icon" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '24px' }}>{form.landing_auth_icon || '⚡'}</span>
                  )}
                  <input type="text" className="form-input" value={form.landing_auth_icon} onChange={(e) => setForm({...form, landing_auth_icon: e.target.value})} placeholder="⚡ o URL de la imagen..." style={{ flex: 1 }} />
                  <input type="file" id="upload_auth_logo" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUploadBanner(e, 'auth_logo')} />
                  <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('upload_auth_logo').click()} disabled={saving} style={{ whiteSpace: 'nowrap' }}>📁 Subir Logo</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tamaño del Logo (Ej: 100px)</label>
                <input type="text" className="form-input" value={form.landing_auth_logo_size} onChange={(e) => setForm({...form, landing_auth_logo_size: e.target.value})} placeholder="100px" />
              </div>
              <div className="form-group">
                <label className="form-label">Tamaño Letra Título (Ej: 24px)</label>
                <input type="text" className="form-input" value={form.landing_auth_title_size} onChange={(e) => setForm({...form, landing_auth_title_size: e.target.value})} placeholder="24px" />
              </div>
              <div className="form-group">
                <label className="form-label">Tamaño Letra Subtítulo (Ej: 14px)</label>
                <input type="text" className="form-input" value={form.landing_auth_text_size} onChange={(e) => setForm({...form, landing_auth_text_size: e.target.value})} placeholder="14px" />
              </div>
            </div>
          </div>
          </>
          )}

          <div className="flex justify-end full-width" style={{ marginTop: '20px' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ minWidth: '180px' }}
              disabled={saving}
            >
              {saving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
      )}

      {activeTab === 'catalogo' && (
      <>
      <div className="section-header-modern" style={{ marginTop: '20px' }}>
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
      </>
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
    </div>
  )
}
